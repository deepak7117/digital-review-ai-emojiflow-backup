"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  getOrCreateFeedbackLink,
  setFeedbackLinkActive,
  updateFeedbackTags,
  type FeedbackLinkState,
} from "@/app/dashboard/qr-feedback/actions";
import { TagEditor } from "@/components/dashboard/TagEditor";

export function QrFeedbackPanel({
  initialLink,
  segmentTagSuggestion = null,
}: {
  initialLink: FeedbackLinkState | null;
  /** Module 7 Milestone B — never null-checked as required; existing behavior is unaffected when this is null (no segment, or already customized/matching). */
  segmentTagSuggestion?: { segmentName: string; tags: string[] } | null;
}) {
  const [link, setLink] = useState<FeedbackLinkState | null>(initialLink);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [applyingSuggestion, setApplyingSuggestion] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    // window.location is only available client-side; this initial read is
    // exactly what useEffect is for (syncing with a browser API that
    // doesn't exist during SSR), not app state we could compute during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const feedbackUrl = link && origin ? `${origin}/feedback/${link.publicCode}` : "";

  useEffect(() => {
    if (!feedbackUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(feedbackUrl, { width: 480, margin: 1, color: { dark: "#14213D" } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [feedbackUrl]);

  async function handleGenerate() {
    setError(null);
    setCreating(true);
    const result = await getOrCreateFeedbackLink();
    setCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLink(result.data);
  }

  async function handleToggle() {
    if (!link) return;
    setError(null);
    setToggling(true);
    const next = !link.isActive;
    const result = await setFeedbackLinkActive(next);
    setToggling(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLink({ ...link, isActive: next });
  }

  async function applySegmentTags() {
    if (!segmentTagSuggestion || !link) return;
    setError(null);
    setApplyingSuggestion(true);
    const result = await updateFeedbackTags(segmentTagSuggestion.tags);
    setApplyingSuggestion(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLink({ ...link, tags: result.data.tags });
    setSuggestionDismissed(true);
  }

  async function handleCopy() {
    if (!feedbackUrl) return;
    await navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "feedback-qr-code.png";
    a.click();
  }

  if (!link) {
    return (
      <div className="rounded-xl border border-border-strong bg-paper-raised p-8 text-center">
        <p className="text-sm text-ink-soft">
          You don&rsquo;t have a feedback link yet. Generate one to get a unique QR
          code you can print and place in your business.
        </p>
        {error && (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="mt-5">
          <Button onClick={handleGenerate} loading={creating}>
            Generate feedback link &amp; QR code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-6 rounded-xl border border-border-strong bg-paper-raised p-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR code linking to your feedback page"
              className="h-40 w-40 rounded-lg border border-border"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-border text-xs text-slate">
              Generating…
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={handleDownload} disabled={!qrDataUrl}>
            Download QR
          </Button>
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
              Feedback link
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border-strong bg-paper px-3 py-2 text-xs text-ink-soft">
                {feedbackUrl || "…"}
              </code>
              <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!feedbackUrl}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md bg-paper px-3.5 py-3">
            <div>
              <p className="text-sm font-medium text-ink">
                {link.isActive ? "Active" : "Paused"}
              </p>
              <p className="text-xs text-slate">
                {link.isActive
                  ? "Customers scanning your QR can leave feedback."
                  : "Your QR page is temporarily hidden from new customers."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={link.isActive}
              onClick={handleToggle}
              disabled={toggling}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                link.isActive ? "bg-verified" : "bg-border-strong"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  link.isActive ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {segmentTagSuggestion && !suggestionDismissed && (
        <div className="rounded-lg border border-verified/25 bg-verified-tint p-4">
          <p className="text-sm text-verified-dark">
            Since you&rsquo;re a {segmentTagSuggestion.segmentName}, we suggest these
            feedback tags instead of the generic default:
          </p>
          <p className="mt-1.5 text-xs text-verified-dark">
            {segmentTagSuggestion.tags.join(", ")}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={applySegmentTags} loading={applyingSuggestion}>
              Apply segment tags
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSuggestionDismissed(true)}
              disabled={applyingSuggestion}
            >
              Keep current tags
            </Button>
          </div>
        </div>
      )}

      <TagEditor
        key={link.tags.join("|")}
        initialTags={link.tags}
        onSaved={(tags) => setLink((prev) => (prev ? { ...prev, tags } : prev))}
      />

      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-4 text-xs leading-relaxed text-slate">
        Every rating from 1 to 5 stars sees the same option to post a review
        on Google — this can&rsquo;t be turned off or made selective from here.
      </div>
    </div>
  );
}
