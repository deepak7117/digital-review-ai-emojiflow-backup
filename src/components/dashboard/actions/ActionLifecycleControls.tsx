"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { setActionStatus } from "@/app/dashboard/intelligence/actions";

type ActionStatus = "open" | "in_progress" | "done";

const STATUS_LABELS: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_TONE: Record<ActionStatus, string> = {
  open: "bg-ink/5 text-ink-soft",
  in_progress: "bg-gold-tint text-gold",
  done: "bg-verified-tint text-verified-dark",
};

/**
 * Action Engine Milestone 2 — the only new client interactivity this
 * milestone adds. Deliberately reuses the EXISTING setActionStatus()
 * server action (src/app/dashboard/intelligence/actions.ts, extended to
 * accept "in_progress" alongside its original "open"/"done") rather than
 * introducing a second, parallel status-update action.
 */
export function ActionLifecycleControls({
  actionKey,
  initialStatus,
}: {
  actionKey: string;
  initialStatus: ActionStatus;
}) {
  const [status, setStatus] = useState<ActionStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function transition(next: ActionStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setActionStatus(actionKey, next);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatus(next);
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <span
        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_TONE[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>

      {error && <span className="text-[10px] text-danger">{error}</span>}

      {status === "open" && (
        <>
          <Button size="sm" variant="secondary" onClick={() => transition("in_progress")} loading={isPending}>
            Start working
          </Button>
          <Button size="sm" variant="ghost" onClick={() => transition("done")} disabled={isPending}>
            Mark done
          </Button>
        </>
      )}
      {status === "in_progress" && (
        <>
          <Button size="sm" variant="secondary" onClick={() => transition("done")} loading={isPending}>
            Mark done
          </Button>
          <Button size="sm" variant="ghost" onClick={() => transition("open")} disabled={isPending}>
            Reopen
          </Button>
        </>
      )}
      {status === "done" && (
        <Button size="sm" variant="ghost" onClick={() => transition("open")} loading={isPending}>
          Reopen
        </Button>
      )}
    </div>
  );
}
