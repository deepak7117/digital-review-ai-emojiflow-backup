import Link from "next/link";
import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import type { ExperienceScoreResult } from "@/lib/insights/experienceScore";
import type { RecommendedAction } from "@/lib/insights/types";
import type { ReputationMetrics } from "@/app/dashboard/reputation/actions";

/**
 * The premium mobile "Home" experience — Section 15's requested
 * hierarchy (header -> score -> sentiment -> needs attention ->
 * recommendation -> voice -> reviews -> setup -> quick actions),
 * reordered slightly because this product's actual data model makes
 * "needs attention" and "recommendation" the same underlying object
 * (topAction) shown once, not twice, which is more honest than
 * presenting one action as if it were two different insights.
 *
 * EVERY value rendered here is a prop passed down from already-computed
 * data in dashboard/page.tsx (the same pipeline /dashboard/intelligence
 * uses) — this component computes nothing itself beyond simple
 * presentation arithmetic (percentages already provided, never derived
 * from guesses). No value here is fabricated; every missing-data case
 * renders an explicit, honest empty state instead of a placeholder
 * number.
 */

interface RecentMessage {
  message: string;
  rating: number;
  createdAt: string;
}

export interface MobileHomeProps {
  ownerName: string | null;
  businessName: string | null;
  hasFeedbackLink: boolean;
  hasEnoughData: boolean;
  currentFeedbackCount: number;
  neededCount: number;
  score: ExperienceScoreResult | null;
  analytics: FeedbackAnalytics | null;
  topAction: RecommendedAction | null;
  recentMessages: RecentMessage[];
  reputation: ReputationMetrics | null;
  connectionLocationName: string | null;
  setupPercent: number;
  setupComplete: boolean;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Excellent" is a positive/success state (Emerald), not an AI state — the AI/Indigo accent is reserved for BD Clarity's own recommendations, shown separately below. */
function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 70) return { ring: "stroke-success", text: "text-success-dark", label: "Excellent" };
  if (score >= 40) return { ring: "stroke-gold", text: "text-gold", label: "Needs attention" };
  return { ring: "stroke-danger", text: "text-danger", label: "At risk" };
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function MobileHome({
  ownerName,
  businessName,
  hasFeedbackLink,
  hasEnoughData,
  currentFeedbackCount,
  neededCount,
  score,
  analytics,
  topAction,
  recentMessages,
  reputation,
  connectionLocationName,
  setupPercent,
  setupComplete,
}: MobileHomeProps) {
  return (
    <div className="flex flex-col gap-4 pb-6 md:hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-ink">
            {greeting()}
            {ownerName ? `, ${ownerName.split(" ")[0]}` : ""} 👋
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">Here&rsquo;s what matters today.</p>
        </div>
      </div>

      {!setupComplete && (
        <Link
          href="/dashboard/profile"
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs"
        >
          <div className="flex-1">
            <p className="text-xs font-medium text-ink-soft">Business setup</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
              <div
                className="h-full rounded-full bg-verified transition-all"
                style={{ width: `${setupPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate">{setupPercent}% complete</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-verified">Finish →</span>
        </Link>
      )}

      {!hasEnoughData ? (
        <SectionCard className="text-center">
          <p className="font-display text-base font-semibold text-ink">
            Your Experience Score is waiting.
          </p>
          <p className="mt-1.5 text-sm text-slate">
            {currentFeedbackCount > 0
              ? `${currentFeedbackCount} of ${neededCount} responses collected — collect a few more to unlock your score.`
              : "Collect your first customer responses to unlock your score."}
          </p>
          <Link
            href="/dashboard/qr-feedback"
            className="mt-4 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-verified px-5 py-2.5 text-sm font-medium text-white shadow-sm"
          >
            {hasFeedbackLink ? "View QR Code" : "Get QR Code"}
          </Link>
        </SectionCard>
      ) : (
        <>
          {/* Experience Score hero */}
          {score && score.score !== null && (
            <SectionCard>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
                Experience Score
              </p>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" strokeWidth="7" className="stroke-ink/[0.07]" fill="none" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      strokeWidth="7"
                      fill="none"
                      strokeLinecap="round"
                      className={scoreTone(score.score).ring}
                      strokeDasharray={`${(score.score / 100) * 213.6} 213.6`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold text-ink">
                    {score.score}
                  </span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${scoreTone(score.score).text}`}>
                    ● {scoreTone(score.score).label}
                  </p>
                  <p className="mt-1 text-xs text-slate">Out of 100, from real customer feedback.</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Sentiment distribution — real percentages from analytics.distribution */}
          {analytics && analytics.total > 0 && (
            <SectionCard>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
                Customer Sentiment
              </p>
              {(() => {
                const byRating = new Map(analytics.distribution.map((d) => [d.rating, d]));
                const positive = (byRating.get(4)?.pct ?? 0) + (byRating.get(5)?.pct ?? 0);
                const neutral = byRating.get(3)?.pct ?? 0;
                const negative = (byRating.get(1)?.pct ?? 0) + (byRating.get(2)?.pct ?? 0);
                return (
                  <>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-success-dark">😊 {positive}% Positive</span>
                      <span className="text-slate">😐 {neutral}%</span>
                      <span className="text-danger">😕 {negative}%</span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                      <div className="bg-success" style={{ width: `${positive}%` }} />
                      <div className="bg-gold" style={{ width: `${neutral}%` }} />
                      <div className="bg-danger" style={{ width: `${negative}%` }} />
                    </div>
                  </>
                );
              })()}
            </SectionCard>
          )}

          {/* Needs Attention / AI Recommendation — same underlying object (topAction), shown once */}
          <SectionCard>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate">
              <span
                className={`h-1.5 w-1.5 rounded-full ${topAction ? "bg-gold" : "bg-success"}`}
                aria-hidden="true"
              />
              {topAction ? "Needs Attention" : "All Clear"}
            </p>
            {topAction ? (
              <>
                <p className="mt-2 text-sm font-semibold text-ink">⚠️ {topAction.title}</p>
                <p className="mt-1 text-xs text-slate">
                  {topAction.evidence.count} of {topAction.evidence.outOf} {topAction.evidence.label}
                </p>
                {topAction.recommendation && (
                  <div className="mt-3 rounded-[var(--radius-sm)] border border-verified/20 bg-verified-tint p-3">
                    <p className="text-xs font-medium text-verified-dark">✨ AI Recommendation</p>
                    <p className="mt-1 text-sm text-ink">{topAction.recommendation}</p>
                  </div>
                )}
                <Link
                  href="/dashboard/actions"
                  className="mt-3 inline-block text-sm font-medium text-verified"
                >
                  View Insight →
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink">✨ No major customer issues detected.</p>
            )}
          </SectionCard>

          {/* Customer Voice excerpts — real recent messages only */}
          {recentMessages.length > 0 && (
            <SectionCard>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate">
                  <span className="h-1.5 w-1.5 rounded-full bg-voice" aria-hidden="true" />
                  Customer Voice
                </p>
                <Link href="/dashboard/feedback" className="text-xs font-medium text-voice-dark">
                  View all →
                </Link>
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {recentMessages.slice(0, 3).map((m, i) => (
                  <div key={i} className="border-l-2 border-voice/30 pl-3">
                    <p className="line-clamp-2 text-sm text-ink">&ldquo;{m.message}&rdquo;</p>
                    <p className="mt-0.5 text-[10px] text-slate">
                      {m.rating >= 4 ? "😊" : m.rating === 3 ? "😐" : "😕"} ·{" "}
                      {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Reviews — independent of the feedback-volume gate above, since it's a different data source */}
      <SectionCard>
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Google Reviews</p>
        {reputation ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-xl font-semibold text-ink">
                ⭐ {reputation.averageRating ?? "—"}
              </span>
              {reputation.newReviewsLast7Days > 0 && (
                <span className="text-xs text-success-dark">
                  +{reputation.newReviewsLast7Days} this week
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate">
              {reputation.totalReviews} total · {reputation.awaitingReply} awaiting reply
            </p>
            <Link href="/dashboard/reputation" className="mt-3 inline-block text-sm font-medium text-verified">
              View all →
            </Link>
          </>
        ) : connectionLocationName ? (
          <>
            <p className="mt-2 text-sm text-ink">Connected to {connectionLocationName}.</p>
            <Link href="/dashboard/reputation" className="mt-2 inline-block text-sm font-medium text-verified">
              Sync reviews →
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate">
              Connect your Google Business Profile to unlock review intelligence.
            </p>
            <Link
              href="/dashboard/settings/google"
              className="mt-3 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-verified px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              Connect Google →
            </Link>
          </>
        )}
      </SectionCard>

      {/* Quick actions */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate">Quick actions</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: "/dashboard/qr-feedback", label: "QR Code", emoji: "📱" },
            { href: "/dashboard/feedback", label: "Feedback", emoji: "💬" },
            { href: "/dashboard/reputation", label: "Reviews", emoji: "⭐" },
            { href: "/dashboard/intelligence", label: "Insights", emoji: "🧠" },
          ].map((qa) => (
            <Link
              key={qa.href}
              href={qa.href}
              className="flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised py-3 shadow-xs active:scale-95"
            >
              <span className="text-xl">{qa.emoji}</span>
              <span className="text-[10px] font-medium text-ink-soft">{qa.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {businessName && (
        <p className="mt-1 text-center text-xs text-slate">{businessName}</p>
      )}
    </div>
  );
}
