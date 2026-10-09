import Link from "next/link";
import type { FeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import type { ExperienceScoreResult } from "@/lib/insights/experienceScore";
import type { RecommendedAction } from "@/lib/insights/types";
import type { ReputationMetrics } from "@/app/dashboard/reputation/actions";

/**
 * Phase 5 — the mobile "Home" experience rebuilt around an explicit
 * product narrative: LISTEN (Customer Voice) -> UNDERSTAND (AI
 * Intelligence) -> INSIGHT (Experience Score) -> ACT (Needs Attention /
 * AI Recommendation), per the approved information architecture. Every
 * value here is still a prop passed down from already-computed data in
 * dashboard/page.tsx — this component computes nothing beyond simple
 * presentation arithmetic (percentages already provided). No value is
 * fabricated; every missing-data case renders an explicit, honest,
 * deliberately premium empty state instead of a placeholder number or a
 * bare "0".
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

/** "Excellent" is a positive/success state (Emerald) — the AI/Indigo accent is reserved for BD Clarity's own intelligence/recommendations, kept visually distinct throughout. */
function scoreTone(score: number): { ring: string; text: string; label: string; context: string } {
  if (score >= 70)
    return {
      ring: "stroke-success",
      text: "text-success-dark",
      label: "Excellent",
      context: "Customer experience is trending positively.",
    };
  if (score >= 40)
    return {
      ring: "stroke-gold",
      text: "text-gold",
      label: "Needs attention",
      context: "A mixed picture — some real opportunities to improve.",
    };
  return {
    ring: "stroke-danger",
    text: "text-danger",
    label: "At risk",
    context: "Recent feedback points to real issues worth addressing.",
  };
}

function SectionLabel({ eyebrow, title, dotClass }: { eyebrow: string; title: string; dotClass: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
        {eyebrow}
      </p>
      <p className="mt-0.5 font-display text-base font-semibold text-ink">{title}</p>
    </div>
  );
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
      {/* Product-level header — the greeting plus an explicit "this is a
          Customer Intelligence product" framing line, not just "Here's
          what matters today." */}
      <div>
        <p className="font-display text-xl font-semibold tracking-tight text-ink">
          {greeting()}
          {ownerName ? `, ${ownerName.split(" ")[0]}` : ""} 👋
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">Here&rsquo;s what your customers are telling you today.</p>
        {businessName && (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate">
            <span className="h-1.5 w-1.5 rounded-full bg-verified" aria-hidden="true" />
            Customer Intelligence · {businessName}
          </p>
        )}
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
        /* Premium zero/early-data state — "the system is ready," never a
           bare "0" dashboard. Previews the real product structure
           (Listen / Understand / Act) so the value is legible even
           before any data exists, per the explicit requirement. */
        <SectionCard className="relative overflow-hidden text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          />
          <p className="relative font-display text-lg font-semibold text-ink">
            Your Customer Intelligence is ready.
          </p>
          <p className="relative mt-1.5 text-sm text-slate">
            {currentFeedbackCount > 0
              ? `${currentFeedbackCount} of ${neededCount} responses collected — your dashboard becomes smarter as more customers respond.`
              : "Your dashboard will become smarter as customers start responding."}
          </p>
          <div className="relative mt-5 grid grid-cols-3 gap-2 text-left">
            <div className="rounded-[var(--radius-sm)] border border-voice/20 bg-voice-tint p-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-voice-dark">Listen</p>
              <p className="mt-1 text-xs text-ink">Customer Voice</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-verified/20 bg-verified-tint p-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-verified-dark">Understand</p>
              <p className="mt-1 text-xs text-ink">AI Intelligence</p>
            </div>
            <div className="rounded-[var(--radius-sm)] border border-gold/20 bg-gold-tint p-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-gold">Act</p>
              <p className="mt-1 text-xs text-ink">Recommendations</p>
            </div>
          </div>
          <Link
            href="/dashboard/qr-feedback"
            className="relative mt-5 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-verified px-5 py-2.5 text-sm font-medium text-white shadow-sm"
          >
            {hasFeedbackLink ? "View QR Code" : "Get QR Code"}
          </Link>
        </SectionCard>
      ) : (
        <>
          {/* INSIGHT — Experience Score, the visually dominant element */}
          {score && score.score !== null && (
            <SectionCard className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{ background: "var(--gradient-brand)" }}
                aria-hidden="true"
              />
              <p className="relative font-mono text-[10px] uppercase tracking-wider text-slate">
                Experience Score
              </p>
              <div className="relative mt-3 flex items-center gap-5">
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
                      className={scoreTone(score.score).ring}
                      strokeDasharray={`${(score.score / 100) * 213.6} 213.6`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl font-semibold text-ink">{score.score}</span>
                    <span className="text-[9px] text-slate">/ 100</span>
                  </span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${scoreTone(score.score).text}`}>
                    ● {scoreTone(score.score).label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{scoreTone(score.score).context}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* LISTEN — Customer Voice, framed as a core product capability */}
          {recentMessages.length > 0 && (
            <SectionCard>
              <div className="flex items-center justify-between">
                <SectionLabel eyebrow="Listen" title="Customer Voice" dotClass="bg-voice" />
                <Link href="/dashboard/feedback" className="text-xs font-medium text-voice-dark">
                  View all →
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate">Here&rsquo;s what your customers are talking about.</p>
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

          {/* UNDERSTAND — AI Intelligence: the same real sentiment data,
              explicitly framed as BD Clarity's own understanding of the
              Customer Voice above, not a second raw data table. */}
          {analytics && analytics.total > 0 && (
            <SectionCard>
              <SectionLabel eyebrow="Understand" title="AI Customer Intelligence" dotClass="bg-verified" />
              <p className="mt-2 text-xs text-slate">What your customers&rsquo; feedback actually means.</p>
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

          {/* ACT — Needs Attention / AI Recommendation. Same underlying
              object (topAction), per the earlier architectural decision
              (the data model has exactly one action, not two) — now
              restructured with explicit "why this matters / recommended
              action / evidence" framing instead of a flat paragraph. */}
          <SectionCard>
            <SectionLabel
              eyebrow="Act"
              title={topAction ? "Needs Attention" : "All Clear"}
              dotClass={topAction ? "bg-gold" : "bg-success"}
            />
            {topAction ? (
              <>
                <p className="mt-2 text-sm font-semibold text-ink">⚠️ {topAction.title}</p>
                <p className="mt-1 text-xs text-slate">
                  Why this matters — {topAction.evidence.count} of {topAction.evidence.outOf}{" "}
                  {topAction.evidence.label}
                </p>
                {topAction.recommendation && (
                  <div className="mt-3 rounded-[var(--radius-sm)] border border-verified/20 bg-verified-tint p-3">
                    <p className="text-xs font-medium text-verified-dark">✨ Recommended action</p>
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
              <p className="mt-2 text-sm text-ink">✨ Nothing urgent right now.</p>
            )}
          </SectionCard>
        </>
      )}

      {/* Reviews — independent of the feedback-volume gate above, since it's a different data source */}
      <SectionCard>
        <SectionLabel eyebrow="Reviews" title="Google Reviews" dotClass="bg-gold" />
        {reputation ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
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
    </div>
  );
}
