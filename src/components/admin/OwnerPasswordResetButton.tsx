"use client";

import { useState, useTransition } from "react";
import { initiateOwnerPasswordReset } from "@/app/admin/ownerAuthActions";

export function OwnerPasswordResetButton({ ownerEmail }: { ownerEmail: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!ownerEmail) return null;

  function handleConfirm() {
    startTransition(async () => {
      const res = await initiateOwnerPasswordReset(ownerEmail);
      setConfirming(false);
      if ("error" in res) {
        setResult({ ok: false, message: res.error });
        return;
      }
      setResult({
        ok: true,
        message: `Password reset triggered via Supabase for ${ownerEmail}. Delivery depends on this environment's email configuration — not independently verifiable here.`,
      });
    });
  }

  return (
    <div className="mt-3">
      {!confirming && (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setResult(null);
          }}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-danger/30 hover:text-danger"
        >
          Initiate Password Reset
        </button>
      )}

      {confirming && (
        <div className="rounded-[var(--radius-md)] border border-danger/20 bg-danger-tint p-3 text-xs">
          <p className="text-ink">
            Send a password reset email to <span className="font-medium">{ownerEmail}</span> via Supabase? The
            owner will set their new password directly — this platform never sees it.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="rounded-[var(--radius-sm)] bg-danger px-3 py-1 font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Sending…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="rounded-[var(--radius-sm)] border border-border-strong px-3 py-1 text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-success-dark" : "text-danger"}`}>{result.message}</p>
      )}
    </div>
  );
}
