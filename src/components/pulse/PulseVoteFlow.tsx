"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { submitVote } from "@/app/pulse/[code]/actions";

function storageKey(code: string): string {
  return `drai_pulse_voted_${code}`;
}

export function PulseVoteFlow({
  code,
  businessName,
  logoUrl,
  question,
  options,
}: {
  code: string;
  businessName: string;
  logoUrl: string | null;
  question: string;
  options: string[];
}) {
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    // Best-effort duplicate-vote prevention, per spec's "one response per
    // appropriate session/device mechanism where practical" — this is
    // client-side only (a different browser or a cleared cache can still
    // vote again), documented as a known limitation, not a hard guarantee.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlreadyVoted(window.localStorage.getItem(storageKey(code)) === "1");
    } catch {
      // localStorage unavailable (private browsing etc.) — fail open, no dedup.
    }
  }, [code]);

  async function handleVote(index: number) {
    setError(null);
    setSubmitting(true);
    const result = await submitVote(code, index);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    try {
      window.localStorage.setItem(storageKey(code), "1");
    } catch {
      // ignore — voting still succeeded server-side
    }
    setVoted(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-ink font-display text-lg font-semibold text-paper-raised"
            aria-hidden="true"
          >
            {businessName.charAt(0)}
          </div>
        )}
        <h1 className="font-display text-lg font-semibold text-ink">{businessName}</h1>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
        <p className="font-display text-base font-semibold text-ink">{question}</p>

        {voted || alreadyVoted ? (
          <div className="mt-4">
            <Alert tone="success">Thanks for your answer!</Alert>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {options.map((option, i) => (
              <button
                key={i}
                type="button"
                disabled={submitting}
                onClick={() => handleVote(i)}
                className="rounded-md border border-border-strong px-4 py-2.5 text-left text-sm text-ink transition-colors hover:border-verified hover:bg-verified-tint disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
