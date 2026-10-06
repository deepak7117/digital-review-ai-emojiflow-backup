"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  isCustomerBrainAiConfigured,
  generateAdvisorNarrative,
} from "@/lib/ai/customerVoiceEnhancer";
import { getPeriodRange, isWithin } from "@/lib/insights/period";
import { computeCustomerVoice, computeRepeatIntentSignal } from "@/lib/insights/customerVoice";
import { computeDemandSignals } from "@/lib/insights/demandDetector";
import type { RecommendedAction } from "@/lib/insights/types";

const SCAN_LIMIT = 3000;

async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ businessId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be logged in." };

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!business) return { error: "Set up your business profile first." };

  return { businessId: business.id };
}

/**
 * Action Engine Milestone 3 — captures a real, server-computed evidence
 * count for this action_key, the FIRST time it's ever called for this
 * business (the unique constraint on action_baseline_snapshots enforces
 * "never overwritten" at the database level too — this check is defense
 * in depth, not the only guard).
 *
 * Deliberately recomputes the current period's insights using the SAME
 * functions every intelligence page already calls (customerVoice.ts,
 * demandDetector.ts) — never a new computation, never a client-supplied
 * count. If the matching insight can't be found (e.g. it's dropped below
 * the visibility threshold since the owner last saw it), this silently
 * skips — no baseline is better than a fabricated one.
 */
async function captureBaselineIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  actionKey: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("action_baseline_snapshots")
    .select("id")
    .eq("business_id", businessId)
    .eq("action_key", actionKey)
    .maybeSingle();

  if (existing) return; // already captured once — never overwritten

  const now = new Date();
  const range = getPeriodRange("30d", now);

  const [feedbackResult, demandResult] = await Promise.all([
    supabase
      .from("feedback_submissions")
      .select("rating, tags, message, created_at")
      .eq("business_id", businessId)
      .gt("created_at", range.previousStart.toISOString())
      .lte("created_at", range.end.toISOString())
      .order("created_at", { ascending: false })
      .limit(SCAN_LIMIT),
    supabase
      .from("unmet_demand_reports")
      .select("reason, detail, created_at")
      .eq("business_id", businessId)
      .gt("created_at", range.previousStart.toISOString())
      .lte("created_at", range.end.toISOString())
      .order("created_at", { ascending: false })
      .limit(SCAN_LIMIT),
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

  const voiceInsights = computeCustomerVoice(currentFeedback, previousFeedback);
  const repeatInsight = computeRepeatIntentSignal(currentFeedback, previousFeedback);
  const demandInsights = computeDemandSignals(currentDemand, previousDemand);
  const allInsights = [...voiceInsights, ...(repeatInsight ? [repeatInsight] : []), ...demandInsights];

  const matching = allInsights.find((i) => i.id === actionKey);
  if (!matching) return; // no real, current evidence to snapshot — skip rather than fabricate

  await supabase.from("action_baseline_snapshots").insert({
    business_id: businessId,
    action_key: actionKey,
    baseline_count: matching.evidence.count,
    evidence_label: matching.evidence.label,
  });
  // Errors here (including a race losing to the unique constraint) are
  // intentionally non-fatal — the status change itself already succeeded
  // and must not fail because of this best-effort measurement step.
}

/**
 * Marks a recommended action open/in_progress/done. Only persists the
 * status — the action's title/evidence/priority are always recomputed
 * live from real data by the caller, never trusted from the client.
 */
export async function setActionStatus(
  actionKey: unknown,
  status: unknown
): Promise<{ ok: true } | { error: string }> {
  if (typeof actionKey !== "string" || !actionKey.trim()) {
    return { error: "Invalid action." };
  }
  if (status !== "open" && status !== "in_progress" && status !== "done") {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const trimmedKey = actionKey.trim().slice(0, 200);

  const { error } = await supabase.from("business_action_status").upsert(
    {
      business_id: owned.businessId,
      action_key: trimmedKey,
      status,
    },
    { onConflict: "business_id,action_key" }
  );

  if (error) return { error: error.message };

  if (status === "in_progress" || status === "done") {
    try {
      await captureBaselineIfNeeded(supabase, owned.businessId, trimmedKey);
    } catch (err) {
      // Non-fatal by design — see captureBaselineIfNeeded's own comment.
      console.error("Baseline capture failed (non-fatal):", err);
    }
  }

  revalidatePath("/dashboard/intelligence");
  revalidatePath("/dashboard/actions");
  return { ok: true };
}

export async function getAiNarrativeStatus(): Promise<{ configured: boolean }> {
  return { configured: isCustomerBrainAiConfigured() };
}

/**
 * Optional AI-generated summary of the current recommendation list. Always
 * safe to call — returns null (not a fake summary) if unconfigured or if
 * the call fails, and never receives raw customer text, only already-
 * computed titles/evidence/trends.
 */
export async function fetchAdvisorNarrative(
  actions: RecommendedAction[]
): Promise<{ narrative: string | null; configured: boolean }> {
  const configured = isCustomerBrainAiConfigured();
  if (!configured) return { narrative: null, configured };

  const narrative = await generateAdvisorNarrative(actions);
  return { narrative, configured };
}
