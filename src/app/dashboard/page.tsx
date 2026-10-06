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

const SCAN_LIMIT = 3000;

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileResult, businessResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("businesses")
      .select("id, business_name, category, city, google_review_url, industry_slug, segment_slug")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const ownerName = profileResult.data?.full_name ?? null;
  const business = businessResult.data;
  const profileComplete = Boolean(business?.business_name);

  const comingSoon = [{ label: "Settings", href: "/dashboard/settings" }];

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
  );
}
