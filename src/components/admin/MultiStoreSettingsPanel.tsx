"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { updatePlatformSettings } from "@/app/admin/platformSettingsActions";

export function MultiStoreSettingsPanel({
  initialEnabled,
  initialMax,
  canEdit,
}: {
  initialEnabled: boolean;
  initialMax: number;
  canEdit: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [max, setMax] = useState(initialMax);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty = enabled !== initialEnabled || max !== initialMax;

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    const result = await updatePlatformSettings(enabled, max);
    setSaving(false);
    if ("error" in result) {
      setStatus("error");
      setErrorMessage(result.error);
      return;
    }
    setStatus("saved");
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
      <p className="font-display text-base font-semibold text-ink">Multi-Store Management</p>
      <p className="mt-1 text-xs text-slate">Controls whether owners can manage more than one business.</p>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-soft">Status</span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              enabled ? "bg-success-tint text-success-dark" : "bg-ink/5 text-slate"
            }`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </button>
        ) : (
          <span className={`text-xs font-medium ${enabled ? "text-success-dark" : "text-slate"}`}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-soft">Maximum businesses per owner</span>
        {canEdit ? (
          <select
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-ink">{max}</span>
        )}
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
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
