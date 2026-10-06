"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { setBusinessStatus } from "@/app/admin/businesses/actions";

type Status = "active" | "inactive" | "suspended";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

/**
 * `canManage` is resolved server-side (hasCapability check in the parent
 * page) and passed down — this component never decides authorization
 * itself. Even if it did render for an unauthorized tier, the underlying
 * setBusinessStatus() action re-checks the capability server-side, and
 * the database function re-checks it again independently — this is
 * presentation-layer convenience only, not the real security boundary.
 */
export function BusinessStatusControl({
  businessId,
  currentStatus,
  canManage,
}: {
  businessId: string;
  currentStatus: Status;
  canManage: boolean;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function confirmChange() {
    if (!pendingStatus) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    const result = await setBusinessStatus(businessId, pendingStatus, reason);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStatus(pendingStatus);
    setSuccess(`Status changed to ${pendingStatus}.`);
    setPendingStatus(null);
    setReason("");
  }

  if (!canManage) {
    return (
      <div className="rounded-lg border border-border-strong bg-paper-raised p-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Account status
        </p>
        <p className="mt-2 text-sm text-ink">{status}</p>
        <p className="mt-1 text-xs text-slate">
          Your admin role can view but not change account status.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-strong bg-paper-raised p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Account status</p>
      <p className="mt-2 text-sm font-medium text-ink">Currently: {status}</p>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {success && (
        <div className="mt-3">
          <Alert tone="success">{success}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.filter((o) => o.value !== status).map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={o.value === "suspended" ? "secondary" : "primary"}
            onClick={() => setPendingStatus(o.value)}
            disabled={saving}
          >
            Set {o.label}
          </Button>
        ))}
      </div>

      {pendingStatus && (
        <div className="mt-4 rounded-md border border-dashed border-border-strong p-3.5">
          <p className="text-xs font-medium text-ink-soft">
            Change status to <span className="font-semibold">{pendingStatus}</span> — reason
            (recorded in the audit log):
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why is this status changing?"
            className="mt-2 w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={confirmChange} loading={saving}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingStatus(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
