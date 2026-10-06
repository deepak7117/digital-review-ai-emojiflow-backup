"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { addSupportNote, type SupportNote } from "@/app/admin/businesses/actions";

export function SupportNotesPanel({
  businessId,
  initialNotes,
  canManage,
  canView,
}: {
  businessId: string;
  initialNotes: SupportNote[];
  canManage: boolean;
  canView: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    setSaving(true);
    const result = await addSupportNote(businessId, draft);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setNotes((prev) => [{ ...result.data, adminEmail: "You" }, ...prev]);
    setDraft("");
  }

  if (!canView) {
    return (
      <div className="rounded-lg border border-border-strong bg-paper-raised p-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Support notes</p>
        <p className="mt-2 text-xs text-slate">
          Your admin role does not have access to support notes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-strong bg-paper-raised p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
        Support notes — internal only, never visible to the business owner
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {canManage && (
        <div className="mt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Add an internal note about this account…"
            className="w-full rounded-md border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleAdd} loading={saving} disabled={!draft.trim()}>
              Add note
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {notes.length === 0 ? (
          <p className="text-xs text-slate">No support notes yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border-strong bg-paper p-3.5">
              <p className="text-sm text-ink">{n.note}</p>
              <p className="mt-1.5 text-[10px] text-slate">
                {n.adminEmail ?? "Unknown admin"} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
