"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { updateBusinessDetails, deleteBusiness } from "@/app/admin/businesses/actions";

interface Initial {
  businessName: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  googleReviewUrl: string | null;
}

const inputCls =
  "w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-verified/30";

export function BusinessEditPanel({
  businessId,
  initial,
  canEdit,
  canDelete,
}: {
  businessId: string;
  initial: Initial;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: initial.businessName,
    category: initial.category ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    address: initial.address ?? "",
    city: initial.city ?? "",
    website: initial.website ?? "",
    googleReviewUrl: initial.googleReviewUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reason, setReason] = useState("");

  if (!canEdit && !canDelete) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    const result = await updateBusinessDetails(businessId, form);
    setSaving(false);
    if ("error" in result) return setError(result.error);
    setSuccess("Business details saved.");
    router.refresh();
  }

  async function remove() {
    setError(null);
    setSaving(true);
    const result = await deleteBusiness(businessId, reason);
    setSaving(false);
    if ("error" in result) return setError(result.error);
    router.push("/admin/businesses");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-strong bg-paper-raised p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Edit business</p>
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
      {success && <div className="mt-3"><Alert tone="success">{success}</Alert></div>}

      {canEdit && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className={inputCls} value={form.businessName} onChange={set("businessName")} placeholder="Business name" />
            <input className={inputCls} value={form.category} onChange={set("category")} placeholder="Category" />
            <input className={inputCls} value={form.phone} onChange={set("phone")} placeholder="Phone" />
            <input className={inputCls} value={form.email} onChange={set("email")} placeholder="Email" />
            <input className={inputCls} value={form.address} onChange={set("address")} placeholder="Address" />
            <input className={inputCls} value={form.city} onChange={set("city")} placeholder="City" />
            <input className={inputCls} value={form.website} onChange={set("website")} placeholder="Website" />
            <input className={inputCls} value={form.googleReviewUrl} onChange={set("googleReviewUrl")} placeholder="Google review URL" />
          </div>
          <div className="mt-4">
            <Button size="sm" onClick={save} loading={saving}>Save changes</Button>
          </div>
        </>
      )}

      {canDelete && (
        <div className="mt-6 border-t border-border pt-4">
          {!confirmingDelete ? (
            <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete business…
            </Button>
          ) : (
            <div className="rounded-md border border-dashed border-danger/40 p-3.5">
              <p className="text-xs font-medium text-danger">
                This permanently deletes the business and all its data. It cannot be undone.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Reason (recorded in the audit log)"
                className="mt-2 w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-xs text-ink"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" onClick={remove} loading={saving}>Confirm delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={saving}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
