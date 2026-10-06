"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { refreshAccessToken } from "@/lib/google/oauth";
import { publishReply } from "@/lib/google/reviewsClient";
import { encryptToken, decryptToken } from "@/lib/google/tokenCrypto";
import { generateGoogleReplies } from "@/lib/reviewEngine/replyGenerator";
import type { ReviewContext } from "@/lib/reviewEngine/types";
import { getSegmentConfig } from "@/lib/segments/engine";

async function getOwnedBusiness(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<
  | { businessId: string; businessName: string; industrySlug: string | null; segmentSlug: string | null }
  | { error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, industry_slug, segment_slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) return { error: "Set up your business profile first." };
  return {
    businessId: business.id,
    businessName: business.business_name,
    industrySlug: business.industry_slug,
    segmentSlug: business.segment_slug,
  };
}

function hexColumnToBuffer(value: string): Buffer {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  return Buffer.from(hex, "hex");
}

export interface ReplyDraftResult {
  draft: string;
  status: "drafted" | "edited" | "publishing" | "published" | "failed" | "none";
}

/**
 * Generates an AI reply draft for one review. Reuses the EXISTING
 * generateGoogleReplies() engine (src/lib/reviewEngine/replyGenerator.ts)
 * exactly as already used for BD-Clarity-native feedback — no new AI
 * engine, no new generation logic. A Google review maps onto the same
 * ReviewContext shape every other caller of this function already uses:
 * rating -> rating, review text -> message, tags: [] (Google reviews have
 * no structured tags), contextAnswers: [] (not applicable to an external
 * review).
 */
export async function generateReplyDraft(
  reviewId: unknown
): Promise<{ data: ReplyDraftResult } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };
  if (typeof reviewId !== "string" || !reviewId) return { error: "Invalid review." };

  const { data: review, error: reviewError } = await supabase
    .from("google_reviews")
    .select("id, rating, comment")
    .eq("id", reviewId)
    .eq("business_id", owned.businessId) // redundant with RLS, defense in depth
    .maybeSingle();

  if (reviewError) return { error: reviewError.message };
  if (!review) return { error: "Review not found." };

  const segmentConfig =
    owned.industrySlug && owned.segmentSlug ? getSegmentConfig(owned.industrySlug, owned.segmentSlug) : null;

  const context: ReviewContext = {
    businessName: owned.businessName,
    segmentConfig,
    rating: review.rating,
    tags: [],
    message: review.comment,
  };

  const generated = generateGoogleReplies(context);
  const draftText = generated.recommended.text;

  const { error: updateError } = await supabase
    .from("google_reviews")
    .update({
      ai_reply_draft: draftText,
      draft_status: "drafted",
      draft_updated_at: new Date().toISOString(),
      publish_error: null,
    })
    .eq("id", reviewId)
    .eq("business_id", owned.businessId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard/reputation");
  return { data: { draft: draftText, status: "drafted" } };
}

/** Owner edits the draft before approving — still entirely local to BD Clarity, nothing published to Google yet. */
export async function updateReplyDraft(
  reviewId: unknown,
  text: unknown
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };
  if (typeof reviewId !== "string" || !reviewId) return { error: "Invalid review." };
  if (typeof text !== "string" || !text.trim()) return { error: "Reply cannot be empty." };

  const { error } = await supabase
    .from("google_reviews")
    .update({
      ai_reply_draft: text.trim().slice(0, 4096),
      draft_status: "edited",
      draft_updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("business_id", owned.businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/reputation");
  return { ok: true };
}

/**
 * Publishes the current draft to Google via the official updateReply
 * endpoint. Also used for retry: a 'failed' row already has its draft
 * text intact, so calling this again is the entire retry mechanism — no
 * separate retry function needed.
 */
export async function publishReviewReply(
  reviewId: unknown
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };
  if (typeof reviewId !== "string" || !reviewId) return { error: "Invalid review." };

  const { data: review, error: reviewError } = await supabase
    .from("google_reviews")
    .select("id, google_review_id, connection_id, ai_reply_draft")
    .eq("id", reviewId)
    .eq("business_id", owned.businessId)
    .maybeSingle();

  if (reviewError) return { error: reviewError.message };
  if (!review) return { error: "Review not found." };
  if (!review.ai_reply_draft) return { error: "Generate a reply draft first." };

  const { data: connection, error: connectionError } = await supabase
    .from("google_business_connections")
    .select(
      "id, google_account_id, google_location_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, status"
    )
    .eq("id", review.connection_id)
    .eq("business_id", owned.businessId)
    .maybeSingle();

  if (connectionError) return { error: connectionError.message };
  if (!connection || connection.status !== "connected") {
    return { error: "This Google connection is no longer active. Reconnect in Settings." };
  }
  if (!connection.google_account_id || !connection.google_location_id) {
    return { error: "This connection is missing its Google location details." };
  }

  await supabase
    .from("google_reviews")
    .update({ draft_status: "publishing" })
    .eq("id", reviewId)
    .eq("business_id", owned.businessId);

  let accessToken: string;
  try {
    accessToken = decryptToken(hexColumnToBuffer(connection.access_token_encrypted));
  } catch {
    await markFailed(supabase, reviewId, owned.businessId, "Could not read stored Google credentials.");
    return { error: "Could not read the stored Google credentials." };
  }

  if (new Date(connection.token_expires_at) <= new Date()) {
    let refreshToken: string;
    try {
      refreshToken = decryptToken(hexColumnToBuffer(connection.refresh_token_encrypted));
    } catch {
      await markFailed(supabase, reviewId, owned.businessId, "Could not read stored Google credentials.");
      return { error: "Could not read the stored Google credentials." };
    }
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) {
      await markFailed(supabase, reviewId, owned.businessId, "Google authorization expired. Please reconnect.");
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

  // google_review_id stores Google's bare "reviewId" field (confirmed via
  // Google's own REST reference: reviewId is "the encrypted unique
  // identifier," a plain string with no slashes — separate from the
  // review's "name" field, which is the full resource path). This
  // reconstruction follows that exact documented pattern:
  // accounts/{accountId}/locations/{locationId}/reviews/{reviewId}.
  const reviewResourceName = `${connection.google_account_id}/${connection.google_location_id}/reviews/${review.google_review_id}`;
  const result = await publishReply(accessToken, reviewResourceName, review.ai_reply_draft);

  if (!result.ok) {
    await markFailed(supabase, reviewId, owned.businessId, result.errorDetail ?? "Publish failed.");
    return { error: result.errorDetail ?? "Could not publish the reply to Google." };
  }

  const now = new Date().toISOString();
  const { error: successUpdateError } = await supabase
    .from("google_reviews")
    .update({
      draft_status: "published",
      owner_reply: review.ai_reply_draft,
      owner_reply_at: now,
      reply_status: "published",
      publish_attempted_at: now,
      publish_error: null,
    })
    .eq("id", reviewId)
    .eq("business_id", owned.businessId);

  if (successUpdateError) return { error: successUpdateError.message };

  revalidatePath("/dashboard/reputation");
  return { ok: true };
}

async function markFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reviewId: string,
  businessId: string,
  errorDetail: string
): Promise<void> {
  await supabase
    .from("google_reviews")
    .update({
      draft_status: "failed",
      publish_attempted_at: new Date().toISOString(),
      publish_error: errorDetail,
    })
    .eq("id", reviewId)
    .eq("business_id", businessId);
}
