/**
 * Pure aggregation logic for Module 5 (Business Dashboard + Analytics).
 *
 * Deliberately has no dependency on Supabase, Next.js, or React — it just
 * takes rows and a reference "now" and returns numbers. That makes it
 * directly unit-testable (see the verification notes in the Module 5
 * report) without a database or a browser.
 *
 * No new database table or migration was needed for this: it aggregates
 * the same feedback_submissions rows Module 3's Feedback Inbox already
 * reads, under the same owner-scoped RLS policy from Module 2.
 */

export interface FeedbackRow {
  rating: number;
  tags: string[];
  created_at: string;
}

export interface RatingBucket {
  rating: number;
  count: number;
  pct: number;
}

export interface WeekBucket {
  /** ISO date (yyyy-mm-dd) for the first day of this bucket. */
  weekStart: string;
  count: number;
  avgRating: number | null;
}

export interface TagStat {
  tag: string;
  count: number;
  avgRating: number;
}

export interface FeedbackAnalytics {
  total: number;
  avgRating: number | null;
  distribution: RatingBucket[];
  weeklyTrend: WeekBucket[];
  tagBreakdown: TagStat[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * @param rows raw feedback rows (already scoped to one business by the caller's query)
 * @param now reference time for bucketing — injectable so this is deterministic in tests
 * @param weeks how many trailing 7-day buckets to produce (oldest first)
 */
export function computeFeedbackAnalytics(
  rows: FeedbackRow[],
  now: Date = new Date(),
  weeks = 8
): FeedbackAnalytics {
  const total = rows.length;

  const distribution: RatingBucket[] = [1, 2, 3, 4, 5].map((rating) => {
    const count = rows.filter((r) => r.rating === rating).length;
    return { rating, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
  });

  const avgRating =
    total > 0 ? round1(rows.reduce((sum, r) => sum + r.rating, 0) / total) : null;

  // Weekly trend: bucket index 0 = the most recent 7-day window ending "now",
  // going backward. Built oldest-first for left-to-right chart rendering.
  const weekBucketsDesc: { count: number; sum: number }[] = Array.from({ length: weeks }, () => ({
    count: 0,
    sum: 0,
  }));

  for (const row of rows) {
    const created = new Date(row.created_at).getTime();
    const ageMs = now.getTime() - created;
    if (ageMs < 0) continue; // ignore any clock-skew future timestamps
    const bucketIndex = Math.floor(ageMs / WEEK_MS);
    if (bucketIndex < 0 || bucketIndex >= weeks) continue; // outside the trend window
    weekBucketsDesc[bucketIndex].count += 1;
    weekBucketsDesc[bucketIndex].sum += row.rating;
  }

  const weeklyTrend: WeekBucket[] = weekBucketsDesc
    .map((bucket, index) => {
      const weekStartMs = now.getTime() - (index + 1) * WEEK_MS;
      return {
        weekStart: toIsoDate(new Date(weekStartMs)),
        count: bucket.count,
        avgRating: bucket.count > 0 ? round1(bucket.sum / bucket.count) : null,
      };
    })
    .reverse(); // oldest first

  // Tag breakdown: frequency + average rating of submissions carrying each tag.
  const tagTotals = new Map<string, { count: number; sum: number }>();
  for (const row of rows) {
    for (const tag of row.tags) {
      const entry = tagTotals.get(tag) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += row.rating;
      tagTotals.set(tag, entry);
    }
  }

  const tagBreakdown: TagStat[] = Array.from(tagTotals.entries())
    .map(([tag, { count, sum }]) => ({ tag, count, avgRating: round1(sum / count) }))
    .sort((a, b) => b.count - a.count);

  return { total, avgRating, distribution, weeklyTrend, tagBreakdown };
}
