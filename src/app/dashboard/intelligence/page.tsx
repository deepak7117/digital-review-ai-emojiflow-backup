import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { getPeriodRange, isWithin, type Period } from "@/lib/insights/period";
import { computeCustomerVoice, computeRepeatIntentSignal } from "@/lib/insights/customerVoice";
import { computeDemandSignals } from "@/lib/insights/demandDetector";
import { computeFeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import { computeExperienceScore } from "@/lib/insights/experienceScore";
import { buildRecommendedActions } from "@/lib/insights/businessAdvisor";
import { isCustomerBrainAiConfigured } from "@/lib/ai/customerVoiceEnhancer";
import { MIN_SAMPLE_SIZE } from "@/lib/insights/types";
import { PeriodSelector } from "@/components/dashboard/intelligence/PeriodSelector";
import { InsightGroup } from "@/components/dashboard/intelligence/InsightGroup";
import { ExperienceScoreCard } from "@/components/dashboard/intelligence/ExperienceScoreCard";
import { RecommendationsPanel } from "@/components/dashboard/intelligence/RecommendationsPanel";
import { getSegmentConfig } from "@/lib/segments/engine";
import { computeBusinessSnapshot } from "@/lib/insights/businessSnapshot";
import { BusinessSnapshotCard } from "@/components/dashboard/intelligence/BusinessSnapshotCard";
import { GettingStartedCard } from "@/components/dashboard/intelligence/GettingStartedCard";

const SCAN_LIMIT = 3000;
const VALID_PERIODS: Period[] = ["today", "7d", "30d", "90d"];

export default async function CustomerIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period: Period = VALID_PERIODS.includes(periodParam as Period)
    ? (periodParam as Period)
    : "30d";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, industry_slug, segment_slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Customer Intelligence</h1>
        <div className="mt-4">
          <Alert tone="info">
            Set up your{" "}
            <Link href="/dashboard/profile" className="font-medium text-verified hover:underline">
              business profile
            </Link>{" "}
            first — Customer Intelligence is built from your feedback data.
          </Alert>
        </div>
      </div>
    );
  }

  const now = new Date();
  const range = getPeriodRange(period, now);

  const [feedbackResult, demandResult, statusResult] = await Promise.all([
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

  const statusByKey = new Map(
    (statusResult.data ?? []).map((s) => [s.action_key, s.status as "open" | "in_progress" | "done"])
  );

  const voiceInsights = computeCustomerVoice(currentFeedback, previousFeedback);
  const repeatInsight = computeRepeatIntentSignal(currentFeedback, previousFeedback);
  const demandInsights = computeDemandSignals(currentDemand, previousDemand);
  const analytics = computeFeedbackAnalytics(currentFeedback, now);
  const experienceScore = computeExperienceScore(analytics, currentDemand.length);

  const allInsights = [...voiceInsights, ...(repeatInsight ? [repeatInsight] : []), ...demandInsights];
  const segmentConfig =
    business.industry_slug && business.segment_slug
      ? getSegmentConfig(business.industry_slug, business.segment_slug)
      : null;
  const actions = buildRecommendedActions(allInsights, statusByKey, segmentConfig, range.label);
  const aiConfigured = isCustomerBrainAiConfigured();

  const snapshot = computeBusinessSnapshot(
    analytics,
    allInsights,
    actions,
    previousFeedback.map((r) => r.rating)
  );

  const hasEnoughData = currentFeedback.length >= MIN_SAMPLE_SIZE;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Customer Intelligence</h1>
          <p className="mt-1 text-sm text-ink-soft">
            What {business.business_name}&rsquo;s{" "}
            {segmentConfig ? segmentConfig.customerTerminology : "customers"} are actually saying —{" "}
            {range.label.toLowerCase()}
            {segmentConfig ? `, tailored for a ${segmentConfig.displayName}` : ""}.
          </p>
        </div>
        <PeriodSelector selected={period} />
      </div>

      {!hasEnoughData ? (
        <GettingStartedCard
          currentCount={currentFeedback.length}
          neededCount={MIN_SAMPLE_SIZE}
          hasBusinessName={!!(business.industry_slug && business.segment_slug)}
        />
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          <BusinessSnapshotCard snapshot={snapshot} />

          <InsightGroup category="love" insights={allInsights} />
          <InsightGroup category="frustration" insights={allInsights} />
          <InsightGroup category="attention" insights={allInsights} />
          <InsightGroup category="request" insights={allInsights} />
          <InsightGroup category="stock" insights={allInsights} />
          <InsightGroup category="repeat" insights={allInsights} />

          <ExperienceScoreCard result={experienceScore} />

          <RecommendationsPanel
            initialActions={actions}
            aiConfigured={aiConfigured}
            segmentName={segmentConfig?.displayName ?? null}
          />

          <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-4 text-center text-xs text-slate">
            Want more direct answers? Run a one-question{" "}
            <Link href="/dashboard/pulse" className="font-medium text-verified hover:underline">
              Customer Pulse poll
            </Link>
            .
          </div>
        </div>
      )}
    </div>
  );
}
