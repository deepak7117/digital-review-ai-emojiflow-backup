"use server";

import { createClient } from "@/lib/supabase/server";
import { generateReviewDraft, isAiConfigured } from "@/lib/ai/reviewDraft";
import { getClientIpHash, checkRateLimit } from "@/lib/utils/rateLimit";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_TAGS = 20;

// Generous enough for a genuine customer completing the flow (including
// retries/edits), tight enough to blunt scripted abuse of a single link.
const DRAFT_RATE_LIMIT = { maxCount: 20, windowSeconds: 600 }; // 20 / 10 min
const SUBMIT_RATE_LIMIT = { maxCount: 5, windowSeconds: 600 }; // 5 / 10 min

function clampRating(value: number): number | null {
  const n = Math.round(value);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

function sanitizeMessage(message: unknown): string {
  if (typeof message !== "string") return "";
  return message.trim().slice(0, MAX_MESSAGE_LENGTH);
}

const ALLOWED_TONES = ["neutral", "detailed", "brief"] as const;
type Tone = (typeof ALLOWED_TONES)[number];

function sanitizeTone(tone: unknown): Tone {
  return typeof tone === "string" && (ALLOWED_TONES as readonly string[]).includes(tone)
    ? (tone as Tone)
    : "neutral";
}

const ALLOWED_UNMET_DEMAND_REASONS = [
  "product_unavailable",
  "size_unavailable",
  "colour_unavailable",
  "too_expensive",
  "service_unavailable",
  "timing_issue",
  "other",
] as const;
type UnmetDemandReason = (typeof ALLOWED_UNMET_DEMAND_REASONS)[number];

function sanitizeUnmetDemandReason(reason: unknown): UnmetDemandReason | null {
  return typeof reason === "string" &&
    (ALLOWED_UNMET_DEMAND_REASONS as readonly string[]).includes(reason)
    ? (reason as UnmetDemandReason)
    : null;
}

const MAX_CONTEXT_ANSWERS = 2; // matches the product rule: at most 2 active questions
const MAX_CONTEXT_QUESTION_LENGTH = 200;
const MAX_CONTEXT_ANSWER_LENGTH = 500;

interface RawContextAnswer {
  questionId?: unknown;
  question: string;
  answer: string;
}

/** Sanitizes the customer's answers to the business's context questions — always optional, never required for generation or submission to work. */
function sanitizeContextAnswers(raw: unknown): RawContextAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: RawContextAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const question =
      typeof (item as Record<string, unknown>).question === "string"
        ? ((item as Record<string, unknown>).question as string).trim().slice(0, MAX_CONTEXT_QUESTION_LENGTH)
        : "";
    const answer =
      typeof (item as Record<string, unknown>).answer === "string"
        ? ((item as Record<string, unknown>).answer as string).trim().slice(0, MAX_CONTEXT_ANSWER_LENGTH)
        : "";
    if (!question || !answer) continue;
    const questionId =
      typeof (item as Record<string, unknown>).questionId === "string"
        ? (item as Record<string, unknown>).questionId
        : undefined;
    out.push({ questionId, question, answer });
    if (out.length >= MAX_CONTEXT_ANSWERS) break;
  }
  return out;
}

/**
 * Generates a review draft grounded only in what the customer has entered so
 * far. Safe to call before the customer has "submitted" anything — this
 * does not write to the database.
 */
export async function generateDraft(input: {
  code: string;
  rating: number;
  tags: unknown;
  message: unknown;
  tone?: unknown;
  contextAnswers?: unknown;
  /** Regeneration counter — only increments on the customer's own explicit "Regenerate" action. See DraftInput's doc comment in reviewDraft.ts. */
  attempt?: unknown;
}): Promise<{ draft: string; source: "template" | "ai" } | { error: string }> {
  const rating = clampRating(input.rating);
  if (rating === null) return { error: "Please choose a star rating first." };

  if (!input.code || typeof input.code !== "string") {
    return { error: "Missing feedback link." };
  }

  const supabase = await createClient();
  const ipHash = await getClientIpHash();
  const allowed = await checkRateLimit(
    supabase,
    "draft",
    `${ipHash}:${input.code}`,
    DRAFT_RATE_LIMIT.maxCount,
    DRAFT_RATE_LIMIT.windowSeconds
  );
  if (!allowed) {
    return { error: "Too many requests right now. Please wait a bit and try again." };
  }

  const tags = sanitizeTags(input.tags);
  const message = sanitizeMessage(input.message);
  const tone = sanitizeTone(input.tone);
  const contextAnswers = sanitizeContextAnswers(input.contextAnswers).map((a) => ({
    question: a.question,
    answer: a.answer,
  }));

  const attempt =
    typeof input.attempt === "number" && Number.isFinite(input.attempt) && input.attempt >= 0
      ? input.attempt
      : 0;

  const result = await generateReviewDraft({ rating, tags, message, tone, contextAnswers, attempt });
  return result;
}

export interface SubmitFeedbackInput {
  code: string;
  rating: number;
  tags: unknown;
  message: unknown;
  aiDraft?: unknown;
  finalDraft: unknown;
  /** Optional — the "Module 6" unmet-demand question. Never mandatory. */
  unmetDemandReason?: unknown;
  unmetDemandDetail?: unknown;
  /** Optional — Module 7 Milestone F: real answers to the business's context questions. Never required. */
  questionAnswers?: unknown;
}

export interface SubmitFeedbackResult {
  googleReviewUrl: string | null;
  businessName: string;
}

/**
 * Resolves the business from the PUBLIC code only (never a client-supplied
 * business id), validates the feedback link is active, and records the
 * submission. Always returns the business's Google review URL (or null if
 * the business hasn't configured one) — the caller must render the same
 * Google CTA regardless of rating; this function never withholds it based
 * on the rating value.
 */
export async function submitFeedback(
  input: SubmitFeedbackInput
): Promise<SubmitFeedbackResult | { error: string }> {
  const rating = clampRating(input.rating);
  if (rating === null) return { error: "Please choose a star rating." };

  const tags = sanitizeTags(input.tags);
  const message = sanitizeMessage(input.message);
  const aiDraft =
    typeof input.aiDraft === "string" ? input.aiDraft.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  const finalDraft =
    typeof input.finalDraft === "string" ? input.finalDraft.trim().slice(0, MAX_MESSAGE_LENGTH) : "";

  if (!input.code || typeof input.code !== "string") {
    return { error: "Missing feedback link." };
  }

  const supabase = await createClient();

  const ipHash = await getClientIpHash();
  const allowed = await checkRateLimit(
    supabase,
    "submit",
    `${ipHash}:${input.code}`,
    SUBMIT_RATE_LIMIT.maxCount,
    SUBMIT_RATE_LIMIT.windowSeconds
  );
  if (!allowed) {
    return { error: "Too many submissions from this connection. Please try again later." };
  }

  // Resolve the business + link purely from the public code. This is the
  // only identifier the client ever has, and it's validated server-side
  // against the database, not trusted as-is.
  const { data: link, error: linkError } = await supabase
    .from("feedback_links")
    .select("id, business_id, is_active")
    .eq("public_code", input.code)
    .maybeSingle();

  if (linkError) return { error: "Something went wrong. Please try again." };
  if (!link || !link.is_active) {
    return { error: "This feedback link is no longer available." };
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, google_review_url")
    .eq("id", link.business_id)
    .maybeSingle();

  if (!business) return { error: "This feedback link is no longer available." };

  // An explicit id lets us link feedback_question_answers to this exact
  // submission without ever needing to SELECT/RETURNING the row back —
  // feedback_submissions has no anon SELECT policy at all (by design, see
  // Module 2), so this avoids the alternative of weakening that privacy
  // guarantee just to learn the generated id.
  const submissionId = crypto.randomUUID();

  const { error: insertError } = await supabase.from("feedback_submissions").insert({
    id: submissionId,
    business_id: link.business_id,
    feedback_link_id: link.id,
    rating,
    tags,
    message: message || null,
    ai_draft: aiDraft || null,
    final_draft: finalDraft || null,
  });

  if (insertError) {
    return { error: "We couldn't save your feedback. Please try again." };
  }

  // Optional context-question answers (Module 7 Milestone F) — never
  // blocks or delays the main feedback submission above, and never
  // mandatory. A failure here is logged but not surfaced as an error to
  // the customer, since their real feedback was already saved
  // successfully — mirrors the existing unmet-demand-report pattern below.
  const contextAnswers = sanitizeContextAnswers(input.questionAnswers);
  if (contextAnswers.length > 0) {
    const { error: answersError } = await supabase.from("feedback_question_answers").insert(
      contextAnswers.map((a) => ({
        feedback_submission_id: submissionId,
        business_id: link.business_id,
        feedback_link_id: link.id,
        question_id: typeof a.questionId === "string" ? a.questionId : null,
        question_text: a.question,
        answer: a.answer,
      }))
    );
    if (answersError) {
      console.error("feedback_question_answers insert failed (non-fatal):", answersError.message);
    }
  }

  // Optional unmet-demand question — never blocks or delays the main
  // feedback submission above, and never mandatory. A failure here is
  // logged but not surfaced as an error to the customer, since their real
  // feedback was already saved successfully.
  const unmetDemandReason = sanitizeUnmetDemandReason(input.unmetDemandReason);
  if (unmetDemandReason) {
    const detail =
      typeof input.unmetDemandDetail === "string"
        ? input.unmetDemandDetail.trim().slice(0, 500)
        : "";
    const { error: demandError } = await supabase.from("unmet_demand_reports").insert({
      business_id: link.business_id,
      feedback_link_id: link.id,
      reason: unmetDemandReason,
      detail: detail || null,
    });
    if (demandError) {
      console.error("unmet_demand_reports insert failed (non-fatal):", demandError.message);
    }
  }

  // In-app owner notification for lower ratings — never blocks or delays
  // the main feedback submission above (already saved successfully by
  // this point), and never mandatory. A failure here is logged but not
  // surfaced as an error to the customer, same non-fatal pattern as the
  // context-answers and unmet-demand-report inserts above. Deliberately
  // carries no raw message/tags — only the rating and a reference to the
  // real feedback_submissions row; the full content remains readable only
  // through that row's own existing RLS, via the Feedback Inbox.
  if (rating <= 2) {
    const { error: notificationError } = await supabase.from("owner_notifications").insert({
      business_id: link.business_id,
      feedback_submission_id: submissionId,
      rating,
    });
    if (notificationError) {
      console.error("owner_notifications insert failed (non-fatal):", notificationError.message);
    }
  }

  // Every rating gets the same response shape — googleReviewUrl is always
  // returned when the business has configured one, regardless of rating.
  // No gating: nothing above or below this line branches on rating for
  // what the customer is offered.
  return {
    googleReviewUrl: business.google_review_url || null,
    businessName: business.business_name,
  };
}

export async function getAiStatus(): Promise<{ configured: boolean }> {
  return { configured: isAiConfigured() };
}
