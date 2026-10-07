import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { DashboardHeroCards } from "@/components/dashboard/DashboardHeroCards";
import { GettingStartedCard } from "@/components/dashboard/intelligence/GettingStartedCard";
import { getPeriodRange, isWithin } from "@/lib/insights/period";
import { computeCustomerVoice, computeRepeatIntentSignal } from "@/lib/insights/customerVoice";
import { computeDemandSignals } from "@/lib/insights/demandDetector";
import { computeFeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import { computeExperienceScore } from "@/lib/insights/experienceScore";
import { buildRecommendedActions } from "@/lib/insights/businessAdvisor";
import { getSegmentConfig } from "@/lib/segments/engine";
import { MIN_SAMPLE_SIZE } from "@/lib/insights/types";
import { MobileHome } from "@/components/dashboard/mobile/MobileHome";
import { getReputationMetrics, getActiveConnectionSummary } from "@/app/dashboard/reputation/actions";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

const SCAN_LIMIT = 3000;

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileResult, activeBusinessResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    getActiveBusiness(supabase),
  ]);

  const ownerName = profileResult.data?.full_name ?? null;
  const business = activeBusinessResult.business;
  const profileComplete = Boolean(business?.business_name);

  const comingSoon = [{ label: "Settings", href: "/dashboard/settings" }];

  // Reuses the EXISTING reputation server actions — zero new data sources.
  const [reputationMetrics, connectionSummary] = await Promise.all([
    getReputationMetrics(),
    getActiveConnectionSummary(),
  ]);
  const reputation = reputationMetrics.totalReviews > 0 ? reputationMetrics : null;

  // Simple completeness tally for the mobile setup-progress indicator —
  // presentation arithmetic only, not a new business-logic system.
  const setupChecks = [
    Boolean(business?.business_name),
    Boolean(business?.category && business?.city),
    Boolean(business?.google_review_url),
    Boolean(business?.industry_slug && business?.segment_slug),
  ];
  const setupPercent = Math.round(
    (setupChecks.filter(Boolean).length / setupChecks.length) * 100
  );
  const setupComplete = setupChecks.every(Boolean);

  // Reuses the EXACT same deterministic pipeline as /dashboard/intelligence
  // — same lib functions, same 30-day default window — nothing here is a
  // second/duplicated computation of business intelligence.
  let hasFeedbackLink = false;
  let hasEnoughData = false;
  let currentFeedbackCount = 0;
  let heroData: {
    score: ReturnType<typeof computeExperienceScore>;
    analytics: ReturnType<typeof computeFeedbackAnalytics>;
    topAction: ReturnType<typeof buildRecommendedActions>[number] | null;
  } | null = null;
  let recentMessages: { message: string; rating: number; createdAt: string }[] = [];

  if (business) {
    const now = new Date();
    const range = getPeriodRange("30d", now);

    const [linkResult, feedbackResult, demandResult, statusResult] = await Promise.all([
      supabase.from("feedback_links").select("public_code").eq("business_id", business.id).maybeSingle(),
      supabase
        .from("feedback_submissions")
        .select("rating, tags, message, created_at")
        .eq("business_id", business.id)
        .gt("created_at", range.previousStart.toISOString())
        .lte("created_at", range.end.toISOString())
        .order("created_at", { ascending: false })
        .limit(SCAN_LIMIT),
      supabase
        .from("unmet_demand_reports")
        .select("reason, detail, created_at")
        .eq("business_id", business.id)
        .gt("created_at", range.previousStart.toISOString())
        .lte("created_at", range.end.toISOString())
        .order("created_at", { ascending: false })
        .limit(SCAN_LIMIT),
      supabase.from("business_action_status").select("action_key, status").eq("business_id", business.id),
    ]);

    hasFeedbackLink = Boolean(linkResult.data);

    const allFeedback = feedbackResult.data ?? [];
    const allDemand = demandResult.data ?? [];
    const currentFeedback = allFeedback.filter((r) => isWithin(r.created_at, range.start, range.end));
    const previousFeedback = allFeedback.filter((r) =>
      isWithin(r.created_at, range.previousStart, range.previousEnd)
    );
    const currentDemand = allDemand.filter((r) => isWithin(r.created_at, range.start, range.end));
    const previousDemand = allDemand.filter((r) =>
      isWithin(r.created_at, range.previousStart, range.previousEnd)
    );

    currentFeedbackCount = currentFeedback.length;
    hasEnoughData = currentFeedbackCount >= MIN_SAMPLE_SIZE;

    // Real excerpts only — never fabricated, never a placeholder quote.
    recentMessages = currentFeedback
      .filter((r): r is typeof r & { message: string } => Boolean(r.message && r.message.trim()))
      .slice(0, 5)
      .map((r) => ({ message: r.message, rating: r.rating, createdAt: r.created_at }));

    if (hasEnoughData) {
      const statusByKey = new Map(
        (statusResult.data ?? []).map((s) => [s.action_key, s.status as "open" | "in_progress" | "done"])
      );
      const voiceInsights = computeCustomerVoice(currentFeedback, previousFeedback);
      const repeatInsight = computeRepeatIntentSignal(currentFeedback, previousFeedback);
      const demandInsights = computeDemandSignals(currentDemand, previousDemand);
      const analytics = computeFeedbackAnalytics(currentFeedback, now);
      const score = computeExperienceScore(analytics, currentDemand.length);
      const allInsights = [...voiceInsights, ...(repeatInsight ? [repeatInsight] : []), ...demandInsights];
      const segmentConfig =
        business.industry_slug && business.segment_slug
          ? getSegmentConfig(business.industry_slug, business.segment_slug)
          : null;
      const actions = buildRecommendedActions(allInsights, statusByKey, segmentConfig, range.label);

      heroData = {
        score,
        analytics,
        topAction: actions.filter((a) => a.status === "open")[0] ?? null,
      };
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Premium mobile home — its own purpose-built hierarchy, not the
          desktop layout shrunk down. Hidden at md and above, where the
          existing desktop layout below (unchanged) takes over. */}
      <MobileHome
        ownerName={ownerName}
        businessName={business?.business_name ?? null}
        hasFeedbackLink={hasFeedbackLink}
        hasEnoughData={hasEnoughData}
        currentFeedbackCount={currentFeedbackCount}
        neededCount={MIN_SAMPLE_SIZE}
        score={heroData?.score ?? null}
        analytics={heroData?.analytics ?? null}
        topAction={heroData?.topAction ?? null}
        recentMessages={recentMessages}
        reputation={reputation}
        connectionLocationName={connectionSummary?.locationName ?? null}
        setupPercent={setupPercent}
        setupComplete={setupComplete}
      />

      <div className="hidden flex-col gap-8 md:flex">
      <DashboardGreeting ownerName={ownerName} businessName={business?.business_name ?? null} />

      {!profileComplete && (
        <Alert tone="info">
          Your business profile is incomplete.{" "}
          <Link href="/dashboard/profile" className="font-medium text-verified hover:underline">
            Finish setting it up
          </Link>{" "}
          so QR Feedback and future modules have what they need.
        </Alert>
      )}

      {profileComplete && !hasFeedbackLink && (
        <Alert tone="info">
          You haven&rsquo;t created your feedback QR code yet.{" "}
          <Link href="/dashboard/qr-feedback" className="font-medium text-verified hover:underline">
            Generate it now
          </Link>{" "}
          to start collecting feedback.
        </Alert>
      )}

      {business && !hasEnoughData && (
        <GettingStartedCard
          currentCount={currentFeedbackCount}
          neededCount={MIN_SAMPLE_SIZE}
          hasBusinessName={!!(business.industry_slug && business.segment_slug)}
        />
      )}

      {business && hasEnoughData && heroData && (
        <DashboardHeroCards
          score={heroData.score}
          analytics={heroData.analytics}
          topAction={heroData.topAction}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Business</p>
          <p className="mt-2 text-sm text-ink">{business?.business_name || "Not set yet"}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
            Google review link
          </p>
          <p className="mt-2 truncate text-sm text-ink">
            {business?.google_review_url || "Not set yet"}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-ink">What&rsquo;s next</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {comingSoon.map((item) => (
            <div
              key={item.href}
              className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-4 text-sm text-slate"
            >
              {item.label}
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-slate/70">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
