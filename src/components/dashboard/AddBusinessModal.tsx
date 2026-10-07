"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Field";
import { createBusiness } from "@/lib/business/actions";

const CATEGORIES = [
  "Restaurant / Cafe",
  "Retail / Shop",
  "Salon / Spa",
  "Healthcare / Clinic",
  "Fitness / Gym",
  "Professional Services",
  "Automotive",
  "Home Services",
  "Hospitality",
  "Other",
];

/**
 * Minimal creation form, per the approved scope: name, type/industry,
 * city only — not the full BusinessProfileForm. The real enforcement
 * (enabled flag, 4-business limit) happens server-side in
 * createBusiness(); this form has no say over whether the attempt
 * succeeds.
 */
export function AddBusinessModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createBusiness({ businessName, category, city });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleCreate}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-6 shadow-lg"
      >
        <p className="font-display text-lg font-semibold text-ink">Add Business</p>
        <p className="mt-1 text-xs text-slate">A new store or location on your account.</p>

        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3.5">
          <Field label="Business Name" htmlFor="add-business-name" required>
            <Input
              id="add-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Business Type / Industry" htmlFor="add-business-category">
            <select
              id="add-business-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-3.5 py-2.5 text-sm text-ink shadow-xs focus:outline-none focus:ring-4 focus:ring-verified/15"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City / Location" htmlFor="add-business-city">
            <Input id="add-business-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
          </Field>
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="submit" loading={saving} className="flex-1">
            Create Business
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
