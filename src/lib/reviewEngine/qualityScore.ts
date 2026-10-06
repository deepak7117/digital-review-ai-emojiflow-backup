import type { QualityScoreResult, ReviewContext, ReviewIntelligence } from "./types";
import { checkCompliance } from "./complianceCheck";

/**
 * Transparent, factor-explained scoring — same discipline as
 * src/lib/insights/experienceScore.ts: every point is traceable to a real
 * check on the actual generated text, never an opaque model output.
 *
 *   Compliance (0-40): proportional to compliance checks passed.
 *   Personalization (0-30): does the text reference an actual topic/tag
 *     from this review? Not penalized if the review had no tags at all.
 *   Length appropriateness (10 or 20): 40-500 chars is the target band.
 *   Tone-matches-rating (0 or 10): a low-rated review's reply should not
 *     read as purely celebratory.
 */
const CELEBRATORY_PATTERN = /delighted|amazing|wonderful|fantastic|thrilled/i;

export function computeQualityScore(
  text: string,
  context: ReviewContext,
  intelligence: ReviewIntelligence
): QualityScoreResult {
  const compliance = checkCompliance(text);
  const factors: QualityScoreResult["factors"] = [];
  let score = 0;

  const passedCount = compliance.checks.filter((c) => c.passed).length;
  const complianceContribution = Math.round((40 * passedCount) / compliance.checks.length);
  score += complianceContribution;
  factors.push({
    label: "Google compliance",
    contribution: complianceContribution,
    detail: `${passedCount}/${compliance.checks.length} compliance checks passed.`,
  });

  const allTopics = [...intelligence.positiveTopics, ...intelligence.negativeTopics];
  const mentionsTopic = allTopics.some((t) => text.toLowerCase().includes(t.toLowerCase()));
  const noTopicsToReference = context.tags.length === 0;
  const personalizationContribution = mentionsTopic || noTopicsToReference ? 30 : 0;
  score += personalizationContribution;
  factors.push({
    label: "Personalization",
    contribution: personalizationContribution,
    detail: mentionsTopic
      ? "References specific topics from this review."
      : noTopicsToReference
        ? "No tags were provided on this review to reference."
        : "Does not reference any specific topic from this review.",
  });

  const lengthOk = text.length >= 40 && text.length <= 500;
  const lengthContribution = lengthOk ? 20 : 10;
  score += lengthContribution;
  factors.push({
    label: "Length appropriateness",
    contribution: lengthContribution,
    detail: `${text.length} characters.`,
  });

  const soundsCelebratory = CELEBRATORY_PATTERN.test(text);
  const toneMatches = intelligence.rating <= 2 ? !soundsCelebratory : true;
  const toneContribution = toneMatches ? 10 : 0;
  score += toneContribution;
  factors.push({
    label: "Tone matches rating",
    contribution: toneContribution,
    detail: toneMatches
      ? "Tone is appropriate for the star rating."
      : "Celebratory language used despite a low rating.",
  });

  return { score: Math.min(100, score), factors };
}
