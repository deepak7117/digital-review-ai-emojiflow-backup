"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { RecommendedAction } from "@/lib/insights/types";
import { topActionsForToday } from "@/lib/insights/businessAdvisor";
import { PRIORITY_LABELS } from "@/lib/insights/priority";
import { PriorityBadge } from "@/components/dashboard/intelligence/PriorityBadge";
import { setActionStatus, fetchAdvisorNarrative } from "@/app/dashboard/intelligence/actions";

const PRIORITY_LABEL: Record<number, string> = { 1: "Priority 1", 2: "Priority 2", 3: "Priority 3" };

export function RecommendationsPanel({
  initialActions,
  aiConfigured,
  segmentName = null,
}: {
  initialActions: RecommendedAction[];
  aiConfigured: boolean;
  /** When set, a small note explains recommendations are tailored to this segment (Module 7 Milestone C). */
  segmentName?: string | null;
}) {
  const [actions, setActions] = useState(initialActions);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, startNarrativeTransition] = useTransition();
  const [narrativeRequested, setNarrativeRequested] = useState(false);

  const todayActions = topActionsForToday(actions, 3);

  async function toggle(actionKey: string, nextStatus: "open" | "done") {
    setError(null);
    setPendingKey(actionKey);
    const result = await setActionStatus(actionKey, nextStatus);
    setPendingKey(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setActions((prev) =>
      prev.map((a) => (a.actionKey === actionKey ? { ...a, status: nextStatus } : a))
    );
  }

  function requestNarrative() {
    setNarrativeRequested(true);
    startNarrativeTransition(async () => {
      const result = await fetchAdvisorNarrative(actions);
      setNarrative(result.narrative);
    });
  }

  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-slate">
        Not enough customer feedback yet to generate recommendations.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert tone="error">{error}</Alert>}

      <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          🎯 What Should I Do Today?
        </p>
        {todayActions.length === 0 ? (
          <p className="mt-3 text-sm text-slate">All caught up — no open high-priority actions right now.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {todayActions.map((action) => (
              <li key={action.actionKey} className="flex items-start gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  disabled={pendingKey === action.actionKey}
                  onClick={() => toggle(action.actionKey, "done")}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border-strong disabled:opacity-50"
                  aria-label={`Mark "${action.title}" as done`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{action.title}</p>
                    <PriorityBadge level={action.priorityLevel} label={PRIORITY_LABELS[action.priorityLevel]} />
                  </div>
                  <p className="text-xs text-slate">Evidence: {action.why}</p>
                  {action.recommendation && (
                    <p className="mt-0.5 text-xs text-verified-dark">
                      Recommended: {action.recommendation}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
              🧠 AI Business Advisor
            </p>
            {segmentName && (
              <p className="mt-1 text-xs text-slate">
                Recommendations tailored for your {segmentName} business, where a
                matching rule exists.
              </p>
            )}
          </div>
          {aiConfigured ? (
            <Button size="sm" variant="secondary" onClick={requestNarrative} loading={narrativeLoading}>
              Generate summary
            </Button>
          ) : (
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate">
              AI narrative: not configured
            </span>
          )}
        </div>

        {narrativeRequested && !narrativeLoading && (
          <div className="mt-3">
            {narrative ? (
              <Alert tone="info">{narrative}</Alert>
            ) : (
              <p className="text-xs text-slate">
                Couldn&rsquo;t generate an AI summary right now — showing the rule-based
                recommendations below instead.
              </p>
            )}
          </div>
        )}

        <ul className="mt-4 flex flex-col gap-4">
          {actions.map((action) => (
            <li key={action.actionKey} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-verified">
                      {PRIORITY_LABEL[action.priority]}
                    </p>
                    <PriorityBadge level={action.priorityLevel} label={PRIORITY_LABELS[action.priorityLevel]} />
                  </div>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      action.status === "done" ? "text-slate line-through" : "text-ink"
                    }`}
                  >
                    {action.title}
                  </p>
                  <p className="mt-1 text-xs text-slate">
                    Evidence: {action.why}
                  </p>
                  {action.recommendation && (
                    <p className="mt-1 text-xs text-verified-dark">
                      Recommended action: {action.recommendation}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pendingKey === action.actionKey}
                  onClick={() => toggle(action.actionKey, action.status === "done" ? "open" : "done")}
                  className="shrink-0 rounded-md border border-border-strong px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-ink disabled:opacity-50"
                >
                  {action.status === "done" ? "Reopen" : "Mark done"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
