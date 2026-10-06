"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  generateReplyDraft,
  updateReplyDraft,
  publishReviewReply,
} from "@/app/dashboard/reputation/replyActions";
import type { ReviewSummary } from "@/app/dashboard/reputation/actions";

type DraftStatus = "none" | "drafted" | "edited" | "publishing" | "published" | "failed";

const STATUS_LABELS: Record<DraftStatus, string> = {
  none: "",
  drafted: "AI draft ready",
  edited: "Edited, not yet published",
  publishing: "Publishing…",
  published: "🟢 Replied on Google",
  failed: "⚠️ Publish failed",
};

export function ReviewReplyCard({
  review,
  initialDraft,
  initialDraftStatus,
  initialPublishError,
}: {
  review: ReviewSummary;
  initialDraft: string | null;
  initialDraftStatus: DraftStatus;
  initialPublishError: string | null;
}) {
  const [draft, setDraft] = useState(initialDraft ?? "");
  const [status, setStatus] = useState<DraftStatus>(initialDraftStatus);
  const [publishError, setPublishError] = useState(initialPublishError);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"generate" | "save" | "publish" | null>(null);

  const alreadyRepliedOnGoogle = Boolean(review.ownerReply) && status !== "failed";

  async function handleGenerate() {
    setBusy("generate");
    setPublishError(null);
    const result = await generateReplyDraft(review.id);
    setBusy(null);
    if ("error" in result) {
      setPublishError(result.error);
      return;
    }
    setDraft(result.data.draft);
    setStatus(result.data.status);
  }

  async function handleSaveEdit() {
    setBusy("save");
    const result = await updateReplyDraft(review.id, draft);
    setBusy(null);
    if ("error" in result) {
      setPublishError(result.error);
      return;
    }
    setStatus("edited");
    setEditing(false);
  }

  async function handlePublish() {
    setBusy("publish");
    setPublishError(null);
    setStatus("publishing");
    const result = await publishReviewReply(review.id);
    setBusy(null);
    if ("error" in result) {
      setStatus("failed");
      setPublishError(result.error);
      return;
    }
    setStatus("published");
  }

  if (alreadyRepliedOnGoogle) {
    return (
      <div className="mt-3 rounded-md border border-border-strong bg-paper p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Existing reply{review.replyStatus ? ` · ${review.replyStatus}` : ""}
        </p>
        <p className="mt-1 text-sm text-ink">{review.ownerReply}</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {publishError && (
        <div className="mb-2">
          <Alert tone="error">{publishError}</Alert>
        </div>
      )}

      {status === "none" ? (
        <Button size="sm" onClick={handleGenerate} loading={busy === "generate"}>
          Generate AI Reply
        </Button>
      ) : (
        <div className="rounded-md border border-border-strong bg-paper p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
            {STATUS_LABELS[status]}
          </p>

          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                maxLength={4096}
                className="mt-2 w-full rounded-md border border-border-strong bg-paper-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} loading={busy === "save"}>
                  Save edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy !== null}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink">{draft}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={handlePublish} loading={busy === "publish"}>
                  {status === "failed" ? "Retry — Approve & Reply on Google" : "Approve & Reply on Google"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={busy !== null}>
                  Edit Reply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerate}
                  loading={busy === "generate"}
                  disabled={busy !== null}
                >
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
