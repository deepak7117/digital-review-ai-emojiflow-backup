import type { Insight, InsightCategory } from "./types";
import { MIN_SAMPLE_SIZE, MIN_SIGNAL_COUNT } from "./types";

export interface VoiceFeedbackRow {
  rating: number;
  tags: string[];
  message: string | null;
  created_at: string;
}

function truncateSnippet(text: string, maxLen = 140): string {
  const trimmed = text.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen).trimEnd()}…` : trimmed;
}

function pctChange(current: number, previous: number): number | null {
  // A meaningful percentage needs a non-zero baseline — with previous=0
  // any "growth" figure would be either undefined or arbitrarily large,
  // so we deliberately show no trend rather than a misleading one.
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

interface TagStats {
  count: number;
  sum: number;
  snippets: string[];
}

function computeTagStats(rows: VoiceFeedbackRow[]): Map<string, TagStats> {
  const map = new Map<string, TagStats>();
  for (const row of rows) {
    for (const tag of row.tags) {
      const entry = map.get(tag) ?? { count: 0, sum: 0, snippets: [] };
      entry.count += 1;
      entry.sum += row.rating;
      if (row.message && entry.snippets.length < 3) {
        entry.snippets.push(truncateSnippet(row.message));
      }
      map.set(tag, entry);
    }
  }
  return map;
}

/**
 * Tag -> category thresholds. A tag's category is decided purely by the
 * average rating of submissions that included it — no keyword guessing,
 * no invented sentiment. avgRating >= 4 reads as "love", <= 2 reads as
 * "frustration" (spec's 🚨), and the 2–4 band reads as "attention" (spec's
 * 😐 — mixed/needs improvement). These thresholds are a deliberate,
 * documented design choice, not a hidden magic number.
 */
function categoryForAvgRating(avgRating: number): InsightCategory {
  if (avgRating >= 4) return "love";
  if (avgRating <= 2) return "frustration";
  return "attention";
}

const REPEAT_INTENT_PATTERNS = [
  /\bcome back\b/i,
  /\bcoming back\b/i,
  /\bwill be back\b/i,
  /\bcomeback\b/i,
  /\bback again\b/i,
  /\breturn(ing)?\b/i,
  /\brecommend\b/i,
  /\bregular\b/i,
  /\bevery (week|time)\b/i,
];

/**
 * Tag-based love/attention/frustration signals. Returns [] (not fabricated
 * placeholders) when there isn't enough data — callers should render
 * "Not enough customer feedback yet." in that case, per spec.
 */
export function computeCustomerVoice(
  currentRows: VoiceFeedbackRow[],
  previousRows: VoiceFeedbackRow[]
): Insight[] {
  if (currentRows.length < MIN_SAMPLE_SIZE) return [];

  const total = currentRows.length;
  const currentStats = computeTagStats(currentRows);
  const previousStats = computeTagStats(previousRows);

  const insights: Insight[] = [];

  for (const [tag, stats] of currentStats.entries()) {
    if (stats.count < MIN_SIGNAL_COUNT) continue;

    const avgRating = stats.sum / stats.count;
    const category = categoryForAvgRating(avgRating);
    const prevCount = previousStats.get(tag)?.count ?? 0;

    insights.push({
      id: `${category}:${tag}`,
      category,
      label: tag,
      evidence: { count: stats.count, outOf: total, label: "feedback submissions mentioned this" },
      trendPct: pctChange(stats.count, prevCount),
      exampleSnippets: stats.snippets,
      source: "deterministic",
    });
  }

  const categoryOrder: Record<string, number> = {
    frustration: 0,
    love: 1,
    attention: 2,
    request: 3,
    stock: 4,
    repeat: 5,
  };
  insights.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    return catDiff !== 0 ? catDiff : b.evidence.count - a.evidence.count;
  });

  return insights;
}

/**
 * Conservative, keyword-based "possible repeat intent" signal — matches
 * only literal language the customer wrote (e.g. "I'll come back", "will
 * recommend"). Deliberately phrased as "possible" everywhere, per spec's
 * explicit instruction not to claim certainty about any individual
 * customer's future behavior. Returns null below the minimum signal count.
 */
export function computeRepeatIntentSignal(
  currentRows: VoiceFeedbackRow[],
  previousRows: VoiceFeedbackRow[]
): Insight | null {
  if (currentRows.length < MIN_SAMPLE_SIZE) return null;

  const matches = currentRows.filter(
    (r) => r.message && REPEAT_INTENT_PATTERNS.some((p) => p.test(r.message as string))
  );
  if (matches.length < MIN_SIGNAL_COUNT) return null;

  const prevMatches = previousRows.filter(
    (r) => r.message && REPEAT_INTENT_PATTERNS.some((p) => p.test(r.message as string))
  ).length;

  return {
    id: "repeat:possible-repeat-intent",
    category: "repeat",
    label: "Possible repeat intent",
    evidence: {
      count: matches.length,
      outOf: currentRows.length,
      label: "customers used language suggesting they may return",
    },
    trendPct: pctChange(matches.length, prevMatches),
    exampleSnippets: matches.slice(0, 3).map((r) => truncateSnippet(r.message as string)),
    source: "deterministic",
  };
}
