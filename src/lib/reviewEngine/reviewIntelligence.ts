import type { ReviewContext, ReviewIntelligence, ReviewType, Urgency, EmotionalTone, Sentiment } from "./types";

/**
 * Splits the review's tags into positive/negative topics.
 *
 * With a segment config: uses the segment's own configured positive/
 * negative tag lists (the same data Module 6's Customer Voice engine
 * reads) — a tag not listed either way falls back to the rating-based
 * split below.
 *
 * Without a segment (or for unlisted tags): a SINGLE review has no
 * historical average-rating-per-tag to lean on (unlike Module 6's
 * aggregate engine, which computes that across many submissions) — so the
 * only honest signal available is the review's own overall rating. This is
 * a real, documented architectural limitation, not a bug: per-tag
 * sentiment within one review is inherently less certain than an
 * aggregate. `confidence` reflects this.
 */
function splitTopics(context: ReviewContext): { positive: string[]; negative: string[] } {
  const { tags, segmentConfig, rating } = context;
  if (tags.length === 0) return { positive: [], negative: [] };

  const positive: string[] = [];
  const negative: string[] = [];

  const positiveSet = new Set(segmentConfig?.feedbackTags.positive ?? []);
  const negativeSet = new Set(segmentConfig?.feedbackTags.negative ?? []);

  for (const tag of tags) {
    if (positiveSet.has(tag) && !negativeSet.has(tag)) {
      positive.push(tag);
    } else if (negativeSet.has(tag) && !positiveSet.has(tag)) {
      negative.push(tag);
    } else {
      // Unlisted, or listed as both (a segment can track a tag as
      // ambiguous, e.g. "Staff Behaviour") — fall back to the review's
      // overall rating as the only available signal for this one review.
      if (rating >= 4) positive.push(tag);
      else if (rating <= 2) negative.push(tag);
      else {
        // A 3-star review with an ambiguous tag: no reliable signal either
        // way. Deliberately omitted from both lists rather than guessed.
        continue;
      }
    }
  }

  return { positive, negative };
}

function sentimentForRating(rating: number): Sentiment {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "mixed";
}

function reviewTypeFor(rating: number, positiveTopics: string[], negativeTopics: string[]): ReviewType {
  if (positiveTopics.length > 0 && negativeTopics.length > 0) return "mixed";
  if (rating <= 2) return "complaint";
  if (rating >= 4) return "praise";
  return "mixed";
}

function urgencyForRating(rating: number): Urgency {
  if (rating <= 2) return "high";
  if (rating === 3) return "medium";
  return "low";
}

const EMOTIONAL_TONE_BY_RATING: Record<number, EmotionalTone> = {
  5: "delighted",
  4: "satisfied",
  3: "neutral",
  2: "frustrated",
  1: "upset",
};

function computeConfidence(context: ReviewContext): number {
  let confidence = 0.4; // baseline: rating alone is always real signal
  confidence += Math.min(context.tags.length, 3) * 0.1;
  if (context.message) {
    confidence += context.message.trim().length > 20 ? 0.3 : 0.15;
  }
  // Real, answered context questions are additional grounded evidence —
  // each answered question nudges confidence up slightly, capped so this
  // alone can't push confidence to 1.0 without other real signal too.
  const answeredCount = (context.contextAnswers ?? []).filter((a) => a.answer.trim()).length;
  confidence += Math.min(answeredCount, 2) * 0.1;
  return Math.min(1, Math.round(confidence * 100) / 100);
}

export function computeReviewIntelligence(context: ReviewContext): ReviewIntelligence {
  const { positive, negative } = splitTopics(context);
  const rating = Math.min(5, Math.max(1, Math.round(context.rating)));

  return {
    sentiment: sentimentForRating(rating),
    rating,
    reviewType: reviewTypeFor(rating, positive, negative),
    positiveTopics: positive,
    negativeTopics: negative,
    urgency: urgencyForRating(rating),
    emotionalTone: EMOTIONAL_TONE_BY_RATING[rating] ?? "neutral",
    confidence: computeConfidence(context),
  };
}
