"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { generateForSubmission, type GenerationResult } from "@/app/dashboard/feedback/generationActions";
import type { Tone, ReplyVariant, GeneratedReply } from "@/lib/reviewEngine/types";
import type { CommentStyle } from "@/lib/reviewEngine/commentGenerator";

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "premium", label: "Premium" },
  { value: "warm", label: "Warm" },
];

const REPLY_VARIANT_LABELS: Record<ReplyVariant, string> = {
  recommended: "Recommended",
  alternativeA: "Alternative A",
  alternativeB: "Alternative B",
  short: "Short",
  detailed: "Detailed",
};

const COMMENT_STYLE_LABELS: Record<CommentStyle, string> = {
  short_natural: "Short & Natural",
  detailed_genuine: "Detailed & Genuine",
  professional: "Professional",
  warm_personal: "Warm & Personal",
};

function ComplianceChecklist({ checks }: { checks: { label: string; passed: boolean }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {checks.map((c) => (
        <li key={c.label} className={`text-[11px] ${c.passed ? "text-verified" : "text-danger"}`}>
          {c.passed ? "✓" : "✗"} {c.label}
        </li>
      ))}
    </ul>
  );
}

function DraftEditor({
  id,
  initialText,
  quality,
  complianceChecks,
}: {
  id: string;
  initialText: string;
  quality: number;
  complianceChecks: { label: string; passed: boolean }[];
}) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md border border-border-strong bg-paper p-3">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setApproved(false); // editing invalidates a prior approval
        }}
        rows={3}
        className="w-full resize-none rounded-md border border-border-strong bg-paper-raised px-2.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
      />
      <div className="mt-2 flex items-center justify-between">
        <ComplianceChecklist checks={complianceChecks} />
        <span className="shrink-0 font-mono text-[10px] text-slate">Quality: {quality}/100</span>
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          size="sm"
          variant={approved ? "primary" : "ghost"}
          onClick={() => setApproved(true)}
        >
          {approved ? "✓ Approved" : "Approve"}
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] text-slate">
        Nothing is ever posted automatically — copy this into Google (or wherever it&rsquo;s
        needed) yourself once you&rsquo;re happy with it.
      </p>
      {/* id kept for stable React keys upstream; not otherwise used here */}
      <span className="hidden">{id}</span>
    </div>
  );
}

export function ReviewGenerator({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"reply" | "comment">("reply");
  const [tone, setTone] = useState<Tone>("professional");
  const [replyVariant, setReplyVariant] = useState<ReplyVariant>("recommended");
  const [commentStyle, setCommentStyle] = useState<CommentStyle>("professional");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    const res = await generateForSubmission(submissionId, tone);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res.data);
  }

  const currentReply: GeneratedReply | null = result ? result.replies[replyVariant] : null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-verified hover:underline"
      >
        {open ? "Hide review assistant" : "Generate reply / comment"}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border-strong p-0.5">
              <button
                type="button"
                onClick={() => setMode("reply")}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  mode === "reply" ? "bg-verified-tint text-verified-dark" : "text-ink-soft"
                }`}
              >
                Business Reply
              </button>
              <button
                type="button"
                onClick={() => setMode("comment")}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  mode === "comment" ? "bg-verified-tint text-verified-dark" : "text-ink-soft"
                }`}
              >
                Comment Draft
              </button>
            </div>

            {mode === "reply" && (
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="rounded-md border border-border-strong bg-paper-raised px-2 py-1 text-xs text-ink"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}

            <Button size="sm" onClick={generate} loading={loading}>
              {result ? "Regenerate" : "Generate"}
            </Button>
          </div>

          {result && mode === "reply" && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(REPLY_VARIANT_LABELS) as ReplyVariant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setReplyVariant(v)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      replyVariant === v
                        ? "border-verified bg-verified-tint text-verified-dark"
                        : "border-border-strong text-ink-soft"
                    }`}
                  >
                    {REPLY_VARIANT_LABELS[v]}
                  </button>
                ))}
              </div>
              {currentReply && (
                <div className="mt-2">
                  <DraftEditor
                    id={`${submissionId}-${replyVariant}`}
                    initialText={currentReply.text}
                    quality={currentReply.quality.score}
                    complianceChecks={currentReply.compliance.checks}
                  />
                </div>
              )}
            </div>
          )}

          {result && mode === "comment" && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(COMMENT_STYLE_LABELS) as CommentStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCommentStyle(s)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      commentStyle === s
                        ? "border-verified bg-verified-tint text-verified-dark"
                        : "border-border-strong text-ink-soft"
                    }`}
                  >
                    {COMMENT_STYLE_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <DraftEditor
                  id={`${submissionId}-${commentStyle}`}
                  initialText={result.comments[commentStyle].text}
                  quality={result.comments[commentStyle].quality.score}
                  complianceChecks={result.comments[commentStyle].compliance.checks}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
