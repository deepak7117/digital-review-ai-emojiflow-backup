import Link from "next/link";
import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import type { ExperienceScoreResult } from "@/lib/insights/experienceScore";
import type { RecommendedAction } from "@/lib/insights/types";

/**
 * Phase 5 — desktop dashboard, rebuilt around the same Listen ->
 * Understand -> Insight -> Act narrative as the mobile Home, replacing
 * the previous flat 6-equal-tile grid (which gave "Feedback Trend" the
 * same visual weight as the Experience Score, and — a real consistency
 * gap found while redesigning this — split "Needs Attention" and "AI
 * Recommendation" into two separate cards even though they are the
 * same underlying topAction object, exactly the issue already
 * corrected on mobile in an earlier milestone). Every value here still
 * comes from the same already-computed pipeline passed in as props —
 * nothing here is a new or duplicated data source.
 */

type Tone = "verified" | "success" | "voice" | "gold" | "danger" | "slate";

const TONE_CLASSES: Record<Tone, { border: string; bg: string; text: string; dot: string }> = {
  verified: { border: "border-verified/20", bg: "bg-verified-tint", text: "text-verified-dark", dot: "bg-verified" },
  success: { border: "border-success/20", bg: "bg-success-tint", text: "text-success-dark", dot: "bg-success" },
  voice: { border: "border-voice/20", bg: "bg-voice-tint", text: "text-voice-dark", dot: "bg-voice" },
  gold: { border: "border-gold/25", bg: "bg-gold-tint", text: "text-gold", dot: "bg-gold" },
  danger: { border: "border-danger/20", bg: "bg-danger-tint", text: "text-danger", dot: "bg-danger" },
  slate: { border: "border-border-strong", bg: "bg-paper-raised", text: "text-ink-soft", dot: "bg-slate" },
};

/**
 * Static class lookup, not dynamic template-literal construction
 * (`stroke-${tone}` etc.) — Tailwind's build-time JIT scanner cannot see
 * through a dynamically-built class name, so a dynamic version here
 * would silently compile with no color at all. Caught and fixed before
 * this was ever tested, not after.
 */
const SCORE_RING_CLASS: Record<"success" | "gold" | "danger", string> = {
  success: "stroke-success",
  gold: "stroke-gold",
  danger: "stroke-danger",
};
const SCORE_TEXT_CLASS: Record<"success" | "gold" | "danger", string> = {
  success: "text-success-dark",
  gold: "text-gold",
  danger: "text-danger",
};

function scoreTone(score: number): { tone: "success" | "gold" | "danger"; label: string; context: string } {
  if (score >= 70)
    return { tone: "success", label: "Excellent", context: "Customer experience is trending positively." };
  if (score >= 40)
    return { tone: "gold", label: "Needs attention", context: "A mixed picture — real room to improve." };
  return { tone: "danger", label: "At risk", context: "Recent feedback points to real issues." };
}

function sentimentSplit(analytics: FeedbackAnalytics): { positive: number; neutral: number; negative: number } {
  const byRating = new Map(analytics.distribution.map((d) => [d.rating, d]));
  return {
    positive: (byRating.get(4)?.pct ?? 0) + (byRating.get(5)?.pct ?? 0),
    neutral: byRating.get(3)?.pct ?? 0,
    negative: (byRating.get(1)?.pct ?? 0) + (byRating.get(2)?.pct ?? 0),
  };
}

function weeklyTrendDirection(weeklyTrend: FeedbackAnalytics["weeklyTrend"]): string {
  const len = weeklyTrend.length;
  if (len < 2) return "Not enough data yet";
  const last = weeklyTrend[len - 1].count;
  const prev = weeklyTrend[len - 2].count;
  if (last > prev) return `↑ Up from ${prev} to ${last} this week`;
  if (last < prev) return `↓ Down from ${prev} to ${last} this week`;
  return `→ Steady at ${last} this week`;
}

function SectionLabel({ eyebrow, title, tone }: { eyebrow: string; title: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate">
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASSES[tone].dot}`} aria-hidden="true" />
          {eyebrow}
        </p>
        <p className="mt-0.5 font-display text-base font-semibold text-ink">{title}</p>
      </div>
    </div>
  );
}

export function DashboardHeroCards({
  score,
  analytics,
  topAction,
}: {
  score: ExperienceScoreResult;
  analytics: FeedbackAnalytics;
  topAction: RecommendedAction | null;
}) {
  const trend = weeklyTrendDirection(analytics.weeklyTrend);
  const sentiment = analytics.total > 0 ? sentimentSplit(analytics) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* INSIGHT — Experience Score, the dominant hero element, not one
          of six equally-weighted tiles. */}
      <Link
        href="/dashboard/intelligence"
        className="relative block overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-6 shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-6">
          {score.score !== null ? (
            <>
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
                  <circle cx="40" cy="40" r="34" strokeWidth="7" className="stroke-ink/[0.07]" fill="none" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    strokeWidth="7"
                    fill="none"
                    strokeLinecap="round"
                    className={SCORE_RING_CLASS[scoreTone(score.score).tone]}
                    strokeDasharray={`${(score.score / 100) * 213.6} 213.6`}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-semibold text-ink">{score.score}</span>
                  <span className="text-[9px] text-slate">/ 100</span>
                </span>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Experience Score</p>
                <p className={`mt-1 text-base font-semibold ${SCORE_TEXT_CLASS[scoreTone(score.score).tone]}`}>
                  ● {scoreTone(score.score).label}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{scoreTone(score.score).context}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Experience Score</p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">Starting to learn</p>
              <p className="mt-1 text-sm text-slate">Collect more customer feedback to establish your baseline.</p>
            </div>
          )}
        </div>
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LISTEN — Customer Voice */}
        <Link
          href="/dashboard/feedback"
          className={`block rounded-[var(--radius-lg)] border ${TONE_CLASSES.voice.border} ${TONE_CLASSES.voice.bg} p-5 transition-transform hover:-translate-y-0.5`}
        >
          <SectionLabel eyebrow="Listen" title="Customer Voice" tone="voice" />
          <p className="mt-3 text-2xl font-semibold text-ink">{analytics.total}</p>
          <p className="text-xs text-slate">submissions in the last 30 days</p>
          <p className="mt-2 text-xs text-ink-soft">{trend}</p>
        </Link>

        {/* UNDERSTAND — AI Intelligence / Sentiment */}
        <Link
          href="/dashboard/intelligence"
          className={`block rounded-[var(--radius-lg)] border ${TONE_CLASSES.verified.border} ${TONE_CLASSES.verified.bg} p-5 transition-transform hover:-translate-y-0.5`}
        >
          <SectionLabel eyebrow="Understand" title="AI Customer Intelligence" tone="verified" />
          {sentiment ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-success-dark">😊 {sentiment.positive}%</span>
              <span className="text-slate">😐 {sentiment.neutral}%</span>
              <span className="text-danger">😕 {sentiment.negative}%</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate">Not enough data yet</p>
          )}
        </Link>

        {/* ACT — Needs Attention + AI Recommendation, ONE object, shown
            once (not duplicated across two cards as before). */}
        <Link
          href="/dashboard/actions"
          className={`block rounded-[var(--radius-lg)] border ${
            topAction ? TONE_CLASSES.gold.border : TONE_CLASSES.success.border
          } ${topAction ? TONE_CLASSES.gold.bg : TONE_CLASSES.success.bg} p-5 transition-transform hover:-translate-y-0.5`}
        >
          <SectionLabel eyebrow="Act" title={topAction ? "Needs Attention" : "All Clear"} tone={topAction ? "gold" : "success"} />
          {topAction ? (
            <>
              <p className="mt-3 text-sm font-semibold text-ink">⚠️ {topAction.title}</p>
              {topAction.recommendation && (
                <p className="mt-2 text-xs text-verified-dark">✨ {topAction.recommendation}</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-ink">✨ Nothing urgent right now.</p>
          )}
        </Link>
      </div>
    </div>
  );
}
