"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { upsertOwnerEntitlement, type OwnerEntitlement } from "@/app/admin/entitlementActions";

const DEFAULT_ENTITLEMENT: OwnerEntitlement = {
  subscriptionStatus: "active",
  planDuration: null,
  startDate: null,
  expiryDate: null,
  paymentId: null,
  multiBusinessEnabled: true,
  maxBusinesses: 4,
  multiBranchEnabled: false,
  maxBranches: 1,
  adminNotes: null,
};

export function OwnerEntitlementPanel({
  ownerId,
  ownerEmail,
  currentBusinessCount,
  platformMaxBusinesses,
  initialEntitlement,
  canEdit,
}: {
  ownerId: string;
  ownerEmail: string | null;
  currentBusinessCount: number;
  platformMaxBusinesses: number;
  initialEntitlement: OwnerEntitlement | null;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<OwnerEntitlement>(initialEntitlement ?? DEFAULT_ENTITLEMENT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveMax = Math.min(form.maxBusinesses, platformMaxBusinesses);

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    const result = await upsertOwnerEntitlement(ownerId, {
      subscriptionStatus: form.subscriptionStatus,
      planDuration: form.planDuration,
      startDate: form.startDate,
      expiryDate: form.expiryDate,
      paymentId: form.paymentId,
      multiBusinessEnabled: form.multiBusinessEnabled,
      maxBusinesses: form.maxBusinesses,
      multiBranchEnabled: form.multiBranchEnabled,
      maxBranches: form.maxBranches,
      adminNotes: form.adminNotes,
    });
    setSaving(false);
    if ("error" in result) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }
    setStatus("saved");
  }

  function update<K extends keyof OwnerEntitlement>(key: K, value: OwnerEntitlement[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
      <p className="font-display text-base font-semibold text-ink">Subscription &amp; Entitlement</p>
      {!initialEntitlement && (
        <p className="mt-1 text-xs text-slate">
          Not individually configured yet — this owner currently uses the platform default (up to{" "}
          {platformMaxBusinesses} businesses).
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Account</p>
          <p className="mt-1.5 text-sm text-ink">{ownerEmail ?? "—"}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Businesses</p>
          <p className="mt-1.5 text-sm text-ink">
            {currentBusinessCount} of {effectiveMax} used
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Subscription Status
          <select
            disabled={!canEdit}
            value={form.subscriptionStatus}
            onChange={(e) => update("subscriptionStatus", e.target.value as OwnerEntitlement["subscriptionStatus"])}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Plan Duration
          <select
            disabled={!canEdit}
            value={form.planDuration ?? ""}
            onChange={(e) =>
              update("planDuration", (e.target.value || null) as OwnerEntitlement["planDuration"])
            }
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          >
            <option value="">—</option>
            <option value="1_year">1 Year</option>
            <option value="2_years">2 Years</option>
            <option value="3_years">3 Years</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Start Date
          <input
            type="date"
            disabled={!canEdit}
            value={form.startDate ?? ""}
            onChange={(e) => update("startDate", e.target.value || null)}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Expiry Date
          <input
            type="date"
            disabled={!canEdit}
            value={form.expiryDate ?? ""}
            onChange={(e) => update("expiryDate", e.target.value || null)}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-xs text-ink-soft">
          Multi-Business
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => update("multiBusinessEnabled", !form.multiBusinessEnabled)}
            className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
              form.multiBusinessEnabled ? "bg-success-tint text-success-dark" : "bg-ink/5 text-slate"
            }`}
          >
            {form.multiBusinessEnabled ? "ON" : "OFF"}
          </button>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Maximum Businesses
          <select
            disabled={!canEdit}
            value={form.maxBusinesses}
            onChange={(e) => update("maxBusinesses", Number(e.target.value))}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-2 text-xs text-ink-soft">
          Multi-Branch
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => update("multiBranchEnabled", !form.multiBranchEnabled)}
            className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
              form.multiBranchEnabled ? "bg-success-tint text-success-dark" : "bg-ink/5 text-slate"
            }`}
          >
            {form.multiBranchEnabled ? "ON" : "OFF"}
          </button>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          Maximum Branches
          <input
            type="number"
            min={1}
            disabled={!canEdit}
            value={form.maxBranches}
            onChange={(e) => update("maxBranches", Math.max(1, Number(e.target.value)))}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft sm:col-span-2">
          Payment ID / Transaction Reference
          <input
            type="text"
            disabled={!canEdit}
            value={form.paymentId ?? ""}
            onChange={(e) => update("paymentId", e.target.value || null)}
            maxLength={200}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-soft sm:col-span-2">
          Internal Notes
          <textarea
            disabled={!canEdit}
            value={form.adminNotes ?? ""}
            onChange={(e) => update("adminNotes", e.target.value || null)}
            maxLength={2000}
            rows={3}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
          />
        </label>
      </div>

      {status === "saved" && (
        <div className="mt-3">
          <Alert tone="success">Saved.</Alert>
        </div>
      )}
      {status === "error" && errorMessage && (
        <div className="mt-3">
          <Alert tone="error">{errorMessage}</Alert>
        </div>
      )}

      {canEdit && (
        <div className="mt-4">
          <Button size="sm" onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      )}
      {!canEdit && (
        <p className="mt-3 text-xs text-slate">Only Super Admin can change customer entitlements.</p>
      )}
    </div>
  );
}
