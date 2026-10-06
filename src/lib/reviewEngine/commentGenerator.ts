import type { ReviewContext, GeneratedComment, CommentType, Tone } from "./types";
import { computeReviewIntelligence } from "./reviewIntelligence";
import { checkCompliance } from "./complianceCheck";
import { computeQualityScore } from "./qualityScore";
import { TONE_POOLS, formatTopicList } from "./templates";

/**
 * Business-facing comment generation — the "AI Comment Generator" from the
 * Milestone E spec. Distinct from Module 2/3's existing customer-facing
 * "AI Review Assistant" (src/lib/ai/reviewDraft.ts), which helps an actual
 * customer phrase THEIR OWN review during their live feedback submission —
 * that flow is untouched by this milestone.
 *
 * This module generates content a BUSINESS might send/post in response to
 * a review it already received (thank-you notes, complaint acknowledgment,
 * follow-up messages). It takes the exact same ReviewContext as
 * replyGenerator.ts — there is no code path here that accepts a free-text
 * "write a review as if you were a customer" prompt, so it is structurally
 * incapable of fabricating a customer experience or persona: every
 * sentence is either a tone-pool fragment or names a real tag/topic from
 * an actual, already-submitted piece of feedback.
 *
 * `style` maps the four named styles from the spec onto this engine's
 * existing tone + length axes, without introducing a second, parallel
 * generation system.
 */

export type CommentStyle = "short_natural" | "detailed_genuine" | "professional" | "warm_personal";

const STYLE_CONFIG: Record<CommentStyle, { tone: Tone; length: "short" | "detailed" }> = {
  short_natural: { tone: "friendly", length: "short" },
  detailed_genuine: { tone: "warm", length: "detailed" },
  professional: { tone: "professional", length: "detailed" },
  warm_personal: { tone: "warm", length: "short" },
};

function defaultCommentType(context: ReviewContext): CommentType {
  const intelligence = computeReviewIntelligence(context);
  if (intelligence.reviewType === "praise") return "appreciation";
  if (intelligence.reviewType === "complaint") return "complaint_acknowledgement";
  return "follow_up";
}

function composeComment(
  context: ReviewContext,
  commentType: CommentType,
  tone: Tone,
  length: "short" | "detailed"
): string {
  const intelligence = computeReviewIntelligence(context);
  const pool = TONE_POOLS[tone];
  const parts: string[] = [];

  switch (commentType) {
    case "appreciation":
    case "thank_you": {
      parts.push(pool.positiveOpeners[0]);
      if (intelligence.positiveTopics.length > 0) {
        parts.push(
          `We're delighted you enjoyed ${formatTopicList(intelligence.positiveTopics).toLowerCase()}.`
        );
      }
      if (length === "detailed") parts.push(pool.positiveClosers[1]);
      break;
    }
    case "complaint_acknowledgement": {
      parts.push(pool.negativeOpeners[0]);
      if (intelligence.negativeTopics.length > 0) {
        parts.push(
          `We understand your concern${intelligence.negativeTopics.length > 1 ? "s" : ""} about ${formatTopicList(
            intelligence.negativeTopics
          ).toLowerCase()}.`
        );
      }
      if (length === "detailed") parts.push(pool.negativeClosers[0]);
      break;
    }
    case "service_recovery": {
      parts.push(pool.negativeOpeners[1]);
      parts.push(pool.negativeClosers[2] ?? pool.negativeClosers[0]);
      break;
    }
    case "follow_up": {
      parts.push(
        intelligence.rating <= 2
          ? pool.negativeOpeners[2] ?? pool.negativeOpeners[0]
          : pool.positiveOpeners[2] ?? pool.positiveOpeners[0]
      );
      if (intelligence.positiveTopics.length > 0 && intelligence.negativeTopics.length > 0) {
        parts.push(
          `We're glad you liked ${formatTopicList(intelligence.positiveTopics).toLowerCase()}, and we're looking into the ${formatTopicList(
            intelligence.negativeTopics
          ).toLowerCase()}.`
        );
      }
      break;
    }
  }

  return parts.filter(Boolean).join(" ");
}

export function generateComment(
  context: ReviewContext,
  style: CommentStyle = "professional",
  commentType?: CommentType
): GeneratedComment {
  const { tone, length } = STYLE_CONFIG[style];
  const resolvedType = commentType ?? defaultCommentType(context);
  const text = composeComment(context, resolvedType, tone, length);
  const intelligence = computeReviewIntelligence(context);

  return {
    text,
    commentType: resolvedType,
    tone,
    compliance: checkCompliance(text),
    quality: computeQualityScore(text, context, intelligence),
  };
}

export function generateAllCommentStyles(context: ReviewContext): Record<CommentStyle, GeneratedComment> {
  const styles: CommentStyle[] = ["short_natural", "detailed_genuine", "professional", "warm_personal"];
  return Object.fromEntries(styles.map((s) => [s, generateComment(context, s)])) as Record<
    CommentStyle,
    GeneratedComment
  >;
}
