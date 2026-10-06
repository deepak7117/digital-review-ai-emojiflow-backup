"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { refreshAccessToken } from "@/lib/google/oauth";
import { listReviews } from "@/lib/google/reviewsClient";
import { encryptToken, decryptToken } from "@/lib/google/tokenCrypto";

// Note: audit logging was intentionally NOT added to this sync action.
// The existing narrow owner audit policy (0011) permits only
// 'google_business_connect'/'google_business_disconnect' — widening it to
// cover a new action here would mean touching an already-existing
// migration's effective policy, which is outside this milestone's
// approved scope (one new table only). Not requested in the approved
// plan either, so left out rather than silently expanding scope.

/**
 * Same defense-in-depth pattern as every other server action in this
 * project: re-resolves the caller's OWN business server-side from the
 * session, never trusts a business/connection id supplied by the client.
 */
async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ businessId: string; userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) return { error: "Set up your business profile first." };
  return { businessId: business.id, userId: user.id };
}

function hexColumnToBuffer(value: string): Buffer {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  return Buffer.from(hex, "hex");
}

export interface ReviewSummary {
  id: string;
  googleReviewId: string;
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  ownerReply: string | null;
  ownerReplyAt: string | null;
  replyStatus: string | null;
  reviewCreatedAt: string | null;
  syncedAt: string;
  aiReplyDraft: string | null;
  draftStatus: "none" | "drafted" | "edited" | "publishing" | "published" | "failed";
  publishError: string | null;
}

/** Lists the caller's OWN already-synced reviews, newest first. Does not call Google — purely reads what's already stored. */
export async function listStoredReviews(): Promise<{ data: ReviewSummary[] } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data, error } = await supabase
    .from("google_reviews")
    .select(
      "id, google_review_id, reviewer_name, rating, comment, owner_reply, owner_reply_at, reply_status, review_created_at, synced_at, ai_reply_draft, draft_status, publish_error"
    )
    .eq("business_id", owned.businessId)
    .order("review_created_at", { ascending: false });

  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((r) => ({
      id: r.id,
      googleReviewId: r.google_review_id,
      reviewerName: r.reviewer_name,
      rating: r.rating,
      comment: r.comment,
      ownerReply: r.owner_reply,
      ownerReplyAt: r.owner_reply_at,
      replyStatus: r.reply_status,
      reviewCreatedAt: r.review_created_at,
      syncedAt: r.synced_at,
      aiReplyDraft: r.ai_reply_draft,
      draftStatus: r.draft_status,
      publishError: r.publish_error,
    })),
  };
}

export interface ReputationMetrics {
  averageRating: number | null;
  totalReviews: number;
  newReviewsLast7Days: number;
  awaitingReply: number;
}

/** Pure aggregation over already-synced reviews — no new Google call. */
export async function getReputationMetrics(): Promise<ReputationMetrics> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { averageRating: null, totalReviews: 0, newReviewsLast7Days: 0, awaitingReply: 0 };

  const { data } = await supabase
    .from("google_reviews")
    .select("rating, review_created_at, owner_reply")
    .eq("business_id", owned.businessId);

  const reviews = data ?? [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return {
    averageRating:
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : null,
    totalReviews: reviews.length,
    newReviewsLast7Days: reviews.filter(
      (r) => r.review_created_at && new Date(r.review_created_at) >= sevenDaysAgo
    ).length,
    awaitingReply: reviews.filter((r) => !r.owner_reply).length,
  };
}

/** Returns the caller's active connection summary, if any — used to decide whether a "Sync" action is even available. */
export async function getActiveConnectionSummary(): Promise<
  { id: string; locationName: string | null } | null
> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return null;

  const { data } = await supabase
    .from("google_business_connections")
    .select("id, google_location_name")
    .eq("business_id", owned.businessId)
    .eq("status", "connected")
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, locationName: data.google_location_name };
}

/**
 * Pulls the latest reviews from Google for the caller's own connected
 * location and upserts them, deduplicated on (connection_id,
 * google_review_id) — re-syncing any number of times never creates
 * duplicate rows; an existing review is updated in place (e.g. if its
 * text or an existing Google-side reply changed) rather than re-inserted.
 *
 * Read-only against Google: calls only reviews.list, never writes
 * anything back to Google. Reply publishing is explicitly out of scope
 * for this milestone.
 */
export async function syncGoogleReviews(): Promise<
  { ok: true; syncedCount: number } | { error: string }
> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data: connection, error: connectionError } = await supabase
    .from("google_business_connections")
    .select(
      "id, google_account_id, google_location_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, status"
    )
    .eq("business_id", owned.businessId)
    .eq("status", "connected")
    .maybeSingle();

  if (connectionError) return { error: connectionError.message };
  if (!connection) return { error: "No connected Google Business Profile location found." };
  if (!connection.google_account_id || !connection.google_location_id) {
    return { error: "This connection is missing its Google location details. Try reconnecting." };
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(hexColumnToBuffer(connection.access_token_encrypted));
  } catch {
    return { error: "Could not read the stored Google credentials." };
  }

  if (new Date(connection.token_expires_at) <= new Date()) {
    let refreshToken: string;
    try {
      refreshToken = decryptToken(hexColumnToBuffer(connection.refresh_token_encrypted));
    } catch {
      return { error: "Could not read the stored Google credentials." };
    }
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) {
      return { error: "Your Google authorization has expired. Please reconnect." };
    }
    accessToken = refreshed.accessToken;
    await supabase
      .from("google_business_connections")
      .update({
        access_token_encrypted: `\\x${encryptToken(refreshed.accessToken).toString("hex")}`,
        token_expires_at: refreshed.expiresAt.toISOString(),
      })
      .eq("id", connection.id);
  }

  // Paginate through every page Google returns — a business with more
  // than one page of reviews must not silently only sync the first 50.
  let pageToken: string | undefined;
  let syncedCount = 0;
  let pageGuard = 0; // safety cap so a misbehaving/looping API response can never hang this action forever

  do {
    const result = await listReviews(
      accessToken,
      connection.google_account_id,
      connection.google_location_id,
      pageToken
    );
    if (!result) {
      return syncedCount > 0
        ? { ok: true, syncedCount } // a later page failed, but earlier pages already synced successfully — report partial success honestly rather than discarding it
        : { error: "Could not reach Google to sync reviews. Please try again." };
    }

    if (result.reviews.length > 0) {
      const { error: upsertError } = await supabase.from("google_reviews").upsert(
        result.reviews.map((r) => ({
          business_id: owned.businessId,
          connection_id: connection.id,
          google_review_id: r.reviewId,
          reviewer_name: r.reviewerName,
          rating: r.starRating ?? 1,
          comment: r.comment,
          owner_reply: r.reviewReplyComment,
          owner_reply_at: r.reviewReplyUpdateTime,
          review_created_at: r.createTime,
          review_updated_at: r.updateTime,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "connection_id,google_review_id" }
      );
      if (upsertError) return { error: upsertError.message };
      syncedCount += result.reviews.length;
    }

    pageToken = result.nextPageToken ?? undefined;
    pageGuard += 1;
  } while (pageToken && pageGuard < 50);

  revalidatePath("/dashboard/reputation");
  return { ok: true, syncedCount };
}
