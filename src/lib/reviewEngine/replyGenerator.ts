import type {
  ReviewContext,
  GeneratedReply,
  GeneratedReplySet,
  ReplyVariant,
  Tone,
} from "./types";
import { computeReviewIntelligence } from "./reviewIntelligence";
import { checkCompliance } from "./complianceCheck";
import { computeQualityScore } from "./qualityScore";
import { TONE_POOLS, formatTopicList } from "./templates";

/**
 * Tiny deterministic string hash (FNV-1a-style) — used only to pick a
 * reproducible-but-varied starting index into the template pools, so the
 * same review always gets the same "recommended" reply (stable, testable)
 * while different reviews naturally land on different phrasing. Not a
 * cryptographic hash; not used for anything security-sensitive.
 */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pick<T>(pool: T[], index: number): T {
  return pool[index % pool.length];
}

/**
 * Composes ONE reply from real review data. `offset` rotates which pool
 * entries are used, so recommended/alternativeA/alternativeB are
 * guaranteed non-identical for the same review (see generateGoogleReplies)
 * without ever inventing content — every sentence either comes from the
 * tone-pool fragments, names a real tag/topic from the review, or quotes a
 * real answer to one of the business's context questions.
 */
function composeReply(
  context: ReviewContext,
  tone: Tone,
  offset: number,
  length: "short" | "standard" | "detailed"
): string {
  const intelligence = computeReviewIntelligence(context);
  const pool = TONE_POOLS[tone];
  const isNegative = intelligence.rating <= 2;

  const opener = isNegative
    ? pick(pool.negativeOpeners, offset)
    : pick(pool.positiveOpeners, offset);
  const closer = isNegative
    ? pick(pool.negativeClosers, offset + 1)
    : pick(pool.positiveClosers, offset + 1);

  const parts: string[] = [opener];

  if (length === "short") {
    // Shortest honest summary: opener + at most one topic mention + closer.
    const topic = intelligence.negativeTopics[0] ?? intelligence.positiveTopics[0];
    if (topic) {
      parts.push(
        intelligence.negativeTopics.includes(topic)
          ? `We're sorry to hear about the ${topic.toLowerCase()}.`
          : `We're glad you enjoyed the ${topic.toLowerCase()}.`
      );
    }
    parts.push(closer);
    return parts.join(" ");
  }

  if (intelligence.positiveTopics.length > 0) {
    parts.push(
      `We're delighted you enjoyed ${formatTopicList(intelligence.positiveTopics).toLowerCase()}.`
    );
  }
  if (intelligence.negativeTopics.length > 0) {
    parts.push(
      `We're sorry to hear about the concern${intelligence.negativeTopics.length > 1 ? "s" : ""} with ${formatTopicList(
        intelligence.negativeTopics
      ).toLowerCase()}.`
    );
  }

  if (length === "detailed") {
    if (context.message && context.message.trim().length > 0) {
      const excerpt = context.message.trim().slice(0, 120);
      parts.push(`We noted what you shared: "${excerpt}${context.message.trim().length > 120 ? "…" : ""}"`);
    }
    // Real context-question answers are optional additional evidence — only
    // ever quoted verbatim (never interpreted/expanded), and only in the
    // detailed variant to keep short/standard replies concise.
    const firstAnswer = (context.contextAnswers ?? []).find((a) => a.answer.trim());
    if (firstAnswer) {
      parts.push(`You also told us: "${firstAnswer.answer.trim().slice(0, 100)}"`);
    }
  }

  parts.push(closer);
  return parts.join(" ");
}

function buildGeneratedReply(
  context: ReviewContext,
  variant: ReplyVariant,
  tone: Tone,
  text: string
): GeneratedReply {
  const intelligence = computeReviewIntelligence(context);
  return {
    text,
    variant,
    tone,
    compliance: checkCompliance(text),
    quality: computeQualityScore(text, context, intelligence),
  };
}

export interface GenerateRepliesOptions {
  tone?: Tone;
  /** Deterministic variation seed — defaults to a hash of the review content so the same review always yields the same set. */
  seed?: number;
  /**
   * Explicit regeneration counter (0 = first generation). Increments
   * only when the owner clicks "Regenerate" — never on an ordinary page
   * load, never automatically. Mixed into the seed so a regenerate
   * request produces a genuinely different, but still grounded,
   * selection from the SAME real template pool — never random/invented
   * content, just a different valid combination of the same real
   * phrases. Previously fixed at 0 implicitly, which combined with a
   * content-only seed made repeated "Regenerate" clicks produce
   * byte-identical output — the confirmed Phase 4 bug.
   */
  attempt?: number;
}

export function generateGoogleReplies(
  context: ReviewContext,
  options: GenerateRepliesOptions = {}
): GeneratedReplySet {
  const tone = options.tone ?? "professional";
  const contentSeed =
    options.seed ??
    hashString(`${context.businessName}|${context.rating}|${context.tags.join(",")}|${context.message ?? ""}`);
  // A large, odd stride so each successive attempt lands on a genuinely
  // different pool index rather than cycling back quickly — odd and
  // coprime with the small pool sizes used below, so it visits more of
  // the pool before repeating than a small/even stride would.
  const attempt = options.attempt ?? 0;
  const seedBase = contentSeed + attempt * 104729;

  const intelligence = computeReviewIntelligence(context);
  // The real fix for the confirmed "Regenerate returns the same text"
  // bug: previously hardcoded to "% 3", silently discarding half of
  // every tone pool's 6 real, already-written variants. Sized off the
  // pool's actual length so it always uses everything that's really
  // there — no new content invented, just no longer throwing away half
  // of what already existed.
  const poolSize = TONE_POOLS[tone].positiveOpeners.length;

  const recommendedText = composeReply(context, tone, seedBase % poolSize, "standard");
  const altAText = composeReply(context, tone, (seedBase + 1) % poolSize, "standard");
  const altBText = composeReply(context, tone, (seedBase + 2) % poolSize, "standard");
  const shortText = composeReply(context, tone, seedBase % poolSize, "short");
  const detailedText = composeReply(context, tone, seedBase % poolSize, "detailed");

  return {
    intelligence,
    recommended: buildGeneratedReply(context, "recommended", tone, recommendedText),
    alternativeA: buildGeneratedReply(context, "alternativeA", tone, altAText),
    alternativeB: buildGeneratedReply(context, "alternativeB", tone, altBText),
    short: buildGeneratedReply(context, "short", tone, shortText),
    detailed: buildGeneratedReply(context, "detailed", tone, detailedText),
  };
}

/**
 * Bulk generation with anti-duplication: if two different reviews would
 * otherwise produce an identical "recommended" reply (e.g. same rating,
 * same single tag, same tone), this rotates the seed for the later one
 * until the text differs, up to a few attempts. Still fully deterministic
 * and grounded — it never introduces content, only shifts which real
 * template fragments are selected.
 */
export function generateBulkReplies(
  reviews: { id: string; context: ReviewContext }[],
  options: { tone?: Tone } = {}
): Map<string, GeneratedReplySet> {
  const usedRecommendedTexts = new Set<string>();
  const results = new Map<string, GeneratedReplySet>();

  for (const review of reviews) {
    const baseSeed = hashString(review.id);
    let attempt = 0;
    let generated = generateGoogleReplies(review.context, { tone: options.tone, seed: baseSeed });

    while (usedRecommendedTexts.has(generated.recommended.text) && attempt < 5) {
      attempt += 1;
      generated = generateGoogleReplies(review.context, {
        tone: options.tone,
        seed: baseSeed + attempt,
      });
    }

    usedRecommendedTexts.add(generated.recommended.text);
    results.set(review.id, generated);
  }

  return results;
}
