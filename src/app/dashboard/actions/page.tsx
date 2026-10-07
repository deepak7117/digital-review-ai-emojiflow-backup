import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPeriodRange, isWithin } from "@/lib/insights/period";
import { computeCustomerVoice, computeRepeatIntentSignal } from "@/lib/insights/customerVoice";
import { computeDemandSignals } from "@/lib/insights/demandDetector";
import { buildRecommendedActions } from "@/lib/insights/businessAdvisor";
import { PRIORITY_LABELS } from "@/lib/insights/priority";
import { getSegmentConfig } from "@/lib/segments/engine";
import { MIN_SAMPLE_SIZE } from "@/lib/insights/types";
import { getActiveBusiness } from "@/lib/business/activeBusiness";
import type { RecommendedAction, PriorityLevel } from "@/lib/insights/types";
import { GettingStartedCard } from "@/components/dashboard/intelligence/GettingStartedCard";
import { PriorityBadge } from "@/components/dashboard/intelligence/PriorityBadge";
import { ActionLifecycleControls } from "@/components/dashboard/actions/ActionLifecycleControls";

const SCAN_LIMIT = 3000;

/**
 * Customer Experience Action Engine — Milestone 1.
 *
 * This page introduces ZERO new intelligence. Every action shown here
 * comes from calling the exact same buildRecommendedActions() (from
 * businessAdvisor.ts) that /dashboard/intelligence already uses — this
 * file only re-groups that already-computed, already-tested output by
 * priorityLevel for a clearer "what should I do" presentation. No new
 * database table, no new recommendation logic, no duplicate Customer
 * Brain/Pulse/Segment Engine.
 *
 * BRANCH SAFETY (explicit, per the approved Milestone 1 scope): this view
 * shows BUSINESS-LEVEL data only. No branch selector exists anywhere on
 * this page, and nothing here claims or implies that any action is
 * specific to one location — no branches table exists in this project yet
 * (Module 7 Milestone 3 was never built), so there is no data to
 * correctly attribute to a specific branch even if a selector existed.
 * True per-branch action isolation is deferred until that milestone.
 */

const RED_LEVELS: PriorityLevel[] = ["critical", "high"];
const YELLOW_LEVELS: PriorityLevel[] = ["medium", "low"];
const GREEN_LEVELS: PriorityLevel[] = ["monitor"];

function groupByBucket(actions: RecommendedAction[]) {
  return {
    red: actions.filter((a) => RED_LEVELS.includes(a.priorityLevel)),
    yellow: actions.filter((a) => YELLOW_LEVELS.includes(a.priorityLevel)),
    green: actions.filter((a) => GREEN_LEVELS.includes(a.priorityLevel)),
  };
}

function BaselineComparison({
  baseline,
  currentCount,
  evidenceLabel,
}: {
  baseline: number;
  currentCount: number;
  evidenceLabel: string;
}) {
  const direction = currentCount < baseline ? "down" : currentCount > baseline ? "up" : "same";
  const arrow = direction === "down" ? "↓" : direction === "up" ? "↑" : "→";
  return (
    <p className="mt-1.5 text-xs text-verified-dark">
      <span className="font-medium">Since you started: </span>
      {baseline} → {currentCount} {evidenceLabel} {arrow}
    </p>
  );
}

function ActionCard({
  action,
  baseline,
}: {
  action: RecommendedAction;
  baseline: number | null;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-ink">{action.title}</p>
        <PriorityBadge level={action.priorityLevel} label={PRIORITY_LABELS[action.priorityLevel]} />
      </div>
      <p className="mt-2 text-xs text-slate">
        <span className="font-medium text-ink-soft">Why this matters: </span>
        {action.why}
      </p>
      {action.recommendation && (
        <p className="mt-1.5 text-xs text-verified-dark">
          <span className="font-medium">Suggested action: </span>
          {action.recommendation}
        </p>
      )}
      <p className="mt-1.5 text-xs text-slate">
        <span className="font-medium text-ink-soft">Expected signal: </span>
        {action.expectedSignal}
      </p>
      {baseline !== null && (
        <BaselineComparison
          baseline={baseline}
          currentCount={action.evidence.count}
          evidenceLabel={action.evidence.label}
        />
      )}
      <p className="mt-2 text-[10px] text-slate">
        {action.evidence.count} of {action.evidence.outOf} {action.evidence.label} ·{" "}
        {action.evidencePeriod}
      </p>
      <ActionLifecycleControls actionKey={action.actionKey} initialStatus={action.status} />
    </div>
  );
}

function BucketSection({
  emoji,
  title,
  actions,
  emptyMessage,
  baselinesByKey,
}: {
  emoji: string;
  title: string;
  actions: RecommendedAction[];
  emptyMessage: string;
  baselinesByKey: Map<string, number>;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
        {emoji} {title}
      </p>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-slate">{emptyMessage}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {actions.map((a) => (
            <ActionCard key={a.actionKey} action={a} baseline={baselinesByKey.get(a.actionKey) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function CustomerActionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { business } = await getActiveBusiness(supabase);

  if (!business) redirect("/dashboard/profile");

  const now = new Date();
  const range = getPeriodRange("30d", now);

  const [feedbackResult, demandResult, statusResult, baselineResult] = await Promise.all([
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
    supabase
      .from("action_baseline_snapshots")
      .select("action_key, baseline_count")
      .eq("business_id", business.id),
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

  const hasEnoughData = currentFeedback.length >= MIN_SAMPLE_SIZE;

  const segmentConfig =
    business.industry_slug && business.segment_slug
      ? getSegmentConfig(business.industry_slug, business.segment_slug)
      : null;

  let buckets = { red: [] as RecommendedAction[], yellow: [] as RecommendedAction[], green: [] as RecommendedAction[] };
  const baselinesByKey = new Map(
    (baselineResult.data ?? []).map((b) => [b.action_key, b.baseline_count])
  );

  if (hasEnoughData) {
    const statusByKey = new Map(
      (statusResult.data ?? []).map((s) => [s.action_key, s.status as "open" | "in_progress" | "done"])
    );
    const voiceInsights = computeCustomerVoice(currentFeedback, previousFeedback);
    const repeatInsight = computeRepeatIntentSignal(currentFeedback, previousFeedback);
    const demandInsights = computeDemandSignals(currentDemand, previousDemand);
    const allInsights = [...voiceInsights, ...(repeatInsight ? [repeatInsight] : []), ...demandInsights];
    const actions = buildRecommendedActions(allInsights, statusByKey, segmentConfig, range.label);
    buckets = groupByBucket(actions);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Customer Actions</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What&rsquo;s happening with {business.business_name}
          {segmentConfig ? ` (${segmentConfig.displayName})` : ""} — {range.label.toLowerCase()}.
        </p>
        <p className="mt-1 text-xs text-slate">
          Shows business-level data. Per-branch views are not yet available.
        </p>
      </div>

      {!hasEnoughData ? (
        <GettingStartedCard
          currentCount={currentFeedback.length}
          neededCount={MIN_SAMPLE_SIZE}
          hasBusinessName={!!(business.industry_slug && business.segment_slug)}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <BucketSection
            emoji="🔴"
            title="Action Needed"
            actions={buckets.red}
            emptyMessage="Nothing urgent right now."
            baselinesByKey={baselinesByKey}
          />
          <BucketSection
            emoji="🟡"
            title="Watch"
            actions={buckets.yellow}
            emptyMessage="Nothing to watch closely right now."
            baselinesByKey={baselinesByKey}
          />
          <BucketSection
            emoji="🟢"
            title="Positive Signal"
            actions={buckets.green}
            emptyMessage="Not enough positive signal data yet."
            baselinesByKey={baselinesByKey}
          />
        </div>
      )}

      <Link href="/dashboard/intelligence" className="text-xs text-verified hover:underline">
        View full Customer Intelligence →
      </Link>
    </div>
  );
}
