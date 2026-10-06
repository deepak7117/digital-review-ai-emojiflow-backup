"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { updateFeedbackTags } from "@/app/dashboard/qr-feedback/actions";
import { DEFAULT_FEEDBACK_TAGS } from "@/lib/config/tags";

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;

export function TagEditor({
  initialTags,
  onSaved,
}: {
  initialTags: string[];
  onSaved?: (tags: string[]) => void;
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: string[]) {
    setError(null);
    setSaving(true);
    const result = await updateFeedbackTags(next);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setTags(result.data.tags);
    onSaved?.(result.data.tags);
  }

  function handleAdd() {
    const trimmed = draft.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmed) return;
    if (tags.length >= MAX_TAGS) {
      setError(`You can have up to ${MAX_TAGS} tags.`);
      return;
    }
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    setDraft("");
    void persist([...tags, trimmed]);
  }

  function handleRemove(tag: string) {
    void persist(tags.filter((t) => t !== tag));
  }

  function handleResetDefaults() {
    void persist([...DEFAULT_FEEDBACK_TAGS]);
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Feedback tags
        </p>
        {saving && <span className="text-xs text-slate">Saving…</span>}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate">
        Optional tags customers can pick from on your feedback page. Tags are
        always optional for the customer — this only changes which chips are
        offered, never whether tagging is required. Applies immediately.
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.length === 0 && (
          <p className="text-xs text-slate">No tags configured — customers will skip straight to written feedback.</p>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-paper px-3 py-1 text-sm text-ink-soft"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => handleRemove(tag)}
              disabled={saving}
              className="text-slate hover:text-danger disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          maxLength={MAX_TAG_LENGTH}
          placeholder="Add a tag, e.g. Parking"
          disabled={saving || tags.length >= MAX_TAGS}
          className="w-48 rounded-md border border-border-strong bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-slate/70 focus:outline-none focus:ring-2 focus:ring-verified/30 disabled:opacity-50"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAdd}
          disabled={saving || !draft.trim() || tags.length >= MAX_TAGS}
        >
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={handleResetDefaults} disabled={saving}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
