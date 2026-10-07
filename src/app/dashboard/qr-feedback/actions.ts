"use server";

import { createClient } from "@/lib/supabase/server";
import { generateFeedbackCode } from "@/lib/utils/slug";
import { revalidatePath } from "next/cache";
import { getSegmentConfig, getFeedbackTagsForSegment } from "@/lib/segments/engine";
import { DEFAULT_FEEDBACK_TAGS } from "@/lib/config/tags";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

export interface FeedbackLinkState {
  publicCode: string;
  isActive: boolean;
  tags: string[];
  createdAt: string;
}

/**
 * Resolves the business owned by the current authenticated user. Never
 * trusts a business id supplied by the client — always looked up from the
 * server-side session.
 */
async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ businessId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be logged in." };

  const { business } = await getActiveBusiness(supabase);
  if (!business) return { error: "Set up your business profile first." };

  return { businessId: business.id };
}

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;

/** Shared sanitizer used by both feedback-link creation and updateFeedbackTags below. */
function sanitizeTagList(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of rawTags) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmed) continue;
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    tags.push(trimmed);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

/**
 * Returns the current feedback link for the caller's business, creating one
 * (with a fresh, collision-checked public_code) if it doesn't exist yet.
 *
 * Milestone B: if the business has selected a valid segment
 * (businesses.industry_slug/segment_slug — see Module 7 Milestone A), a
 * brand-new link is created with that segment's tags
 * (getFeedbackTagsForSegment) instead of the generic default. This only
 * ever applies at CREATION time — an existing link's tags are never
 * silently rewritten here (see the separate suggestion flow in
 * QrFeedbackPanel.tsx for links that already exist). A business with no
 * segment, or an unrecognized/stale segment pair, falls back to the exact
 * pre-Milestone-B behavior: the tags column is omitted from the insert and
 * the database default (Module 2's generic 7-tag set) applies, unchanged.
 */
export async function getOrCreateFeedbackLink(): Promise<
  { data: FeedbackLinkState } | { error: string }
> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const existing = await supabase
    .from("feedback_links")
    .select("public_code, is_active, tags, created_at")
    .eq("business_id", owned.businessId)
    .maybeSingle();

  if (existing.error) return { error: existing.error.message };

  if (existing.data) {
    return {
      data: {
        publicCode: existing.data.public_code,
        isActive: existing.data.is_active,
        tags: existing.data.tags,
        createdAt: existing.data.created_at,
      },
    };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, industry_slug, segment_slug")
    .eq("id", owned.businessId)
    .single();

  const segmentConfig =
    business?.industry_slug && business?.segment_slug
      ? getSegmentConfig(business.industry_slug, business.segment_slug)
      : null;

  // Falls back to the pre-Milestone-B default (7 generic tags) when there's
  // no valid segment — never fabricated, always either the segment's real
  // configured tags or the existing Module 2 default.
  const initialTags = segmentConfig
    ? sanitizeTagList(getFeedbackTagsForSegment(segmentConfig))
    : sanitizeTagList([...DEFAULT_FEEDBACK_TAGS]);

  // Retry a handful of times in the unlikely event of a public_code
  // collision (unique constraint enforced at the database level).
  for (let attempt = 0; attempt < 5; attempt++) {
    const publicCode = generateFeedbackCode(business?.business_name ?? "business");

    const insert = await supabase
      .from("feedback_links")
      .insert({ business_id: owned.businessId, public_code: publicCode, tags: initialTags })
      .select("public_code, is_active, tags, created_at")
      .single();

    if (!insert.error && insert.data) {
      revalidatePath("/dashboard/qr-feedback");
      return {
        data: {
          publicCode: insert.data.public_code,
          isActive: insert.data.is_active,
          tags: insert.data.tags,
          createdAt: insert.data.created_at,
        },
      };
    }

    // 23505 = unique_violation — try again with a new random suffix.
    if (insert.error && insert.error.code !== "23505") {
      return { error: insert.error.message };
    }
  }

  return { error: "Couldn't generate a unique link right now. Please try again." };
}

export async function setFeedbackLinkActive(
  isActive: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabase
    .from("feedback_links")
    .update({ is_active: isActive })
    .eq("business_id", owned.businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/qr-feedback");
  return { ok: true };
}

/**
 * Validates and persists the full tag set for the caller's feedback link.
 * Tags stay optional for the customer regardless of how many (or how few —
 * including zero) the business configures here; this only changes which
 * chips are offered, never whether tagging itself is required.
 */
export async function updateFeedbackTags(
  rawTags: string[]
): Promise<{ data: { tags: string[] } } | { error: string }> {
  if (!Array.isArray(rawTags)) return { error: "Invalid tags." };

  const tags = sanitizeTagList(rawTags);

  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data, error } = await supabase
    .from("feedback_links")
    .update({ tags })
    .eq("business_id", owned.businessId)
    .select("tags")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/qr-feedback");
  return { data: { tags: data.tags } };
}
