"use server";

import { createClient } from "@/lib/supabase/server";
import { getSegmentConfig } from "@/lib/segments/engine";
import { generateGoogleReplies } from "@/lib/reviewEngine/replyGenerator";
import { generateAllCommentStyles } from "@/lib/reviewEngine/commentGenerator";
import type { GeneratedReplySet, Tone } from "@/lib/reviewEngine/types";
import type { CommentStyle } from "@/lib/reviewEngine/commentGenerator";
import type { GeneratedComment } from "@/lib/reviewEngine/types";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

/**
 * Resolves the caller's own business — never trusts a business id supplied
 * by the client. Same pattern as every other owner-scoped action in this
 * project (qr-feedback/actions.ts, profile/questionsActions.ts, etc.).
 */
async function getOwnedBusiness(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<
  | { business: { id: string; business_name: string; industry_slug: string | null; segment_slug: string | null } }
  | { error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { business } = await getActiveBusiness(supabase);
  if (!business) return { error: "Set up your business profile first." };

  return { business };
}

export interface GenerationResult {
  replies: GeneratedReplySet;
  comments: Record<CommentStyle, GeneratedComment>;
}

/**
 * Generates both a Google-reply set and the four comment-style drafts for
 * one of the caller's OWN feedback submissions.
 *
 * Security: the submission is fetched scoped to `business_id = <caller's
 * own business>` — resolved server-side from the session, not from
 * anything the client sent. This mirrors the RLS policy
 * (feedback_submissions_select_own) as defense in depth, exactly like
 * every other owner-scoped query in this project.
 *
 * Evidence: rating/tags/message come directly from the real, already-
 * submitted row. Context-question answers are NOT wired in yet — there is
 * no live UI collecting them during the customer feedback flow (that would
 * touch the frozen Module 2/3 FeedbackFlow.tsx beyond minimal integration,
 * out of scope for this milestone) — so `contextAnswers` is always an
 * empty array here. The engine (ReviewContext.contextAnswers?) is already
 * built to accept real answers the moment that collection exists, and to
 * work identically well without them, which this call path demonstrates.
 */
export async function generateForSubmission(
  submissionId: unknown,
  tone: unknown
): Promise<{ data: GenerationResult } | { error: string }> {
  if (typeof submissionId !== "string" || !submissionId) return { error: "Invalid feedback." };

  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data: submission, error } = await supabase
    .from("feedback_submissions")
    .select("id, rating, tags, message")
    .eq("id", submissionId)
    .eq("business_id", owned.business.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!submission) return { error: "Feedback not found." };

  const segmentConfig =
    owned.business.industry_slug && owned.business.segment_slug
      ? getSegmentConfig(owned.business.industry_slug, owned.business.segment_slug)
      : null;

  const resolvedTone: Tone = (["professional", "friendly", "premium", "warm"] as const).includes(
    tone as Tone
  )
    ? (tone as Tone)
    : "professional";

  const context = {
    businessName: owned.business.business_name,
    segmentConfig,
    rating: submission.rating,
    tags: submission.tags,
    message: submission.message,
    contextAnswers: [], // see doc comment above — not collected live yet
  };

  const replies = generateGoogleReplies(context, { tone: resolvedTone, seed: hashSubmissionId(submission.id) });
  const comments = generateAllCommentStyles(context);

  return { data: { replies, comments } };
}

/** Same tiny deterministic hash as replyGenerator.ts, so results are stable per submission across calls. */
function hashSubmissionId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}
