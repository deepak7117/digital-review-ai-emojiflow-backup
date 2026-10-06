"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { submitFeedback, generateDraft } from "@/app/feedback/[code]/actions";

/**
 * Final CX simplification — emoji-only reaction, no questionnaire, no
 * editable draft screen. See BD_Clarity_CHANGELOG.md for the full
 * OLD -> NEW flow rationale. The `questions` prop is kept for type
 * compatibility with the (unchanged) server page and the owner's
 * still-fully-functional question-management system — it is simply never
 * rendered here anymore.
 */
type Step = "emoji" | "generating" | "ready" | "recoveryDetail" | "recoveryThanks";

interface EmojiOption {
  rating: number;
  emoji: string;
  label: string;
}

const EMOJI_OPTIONS: EmojiOption[] = [
  { rating: 1, emoji: "😡", label: "Not great" },
  { rating: 2, emoji: "😕", label: "Could be better" },
  { rating: 3, emoji: "😐", label: "It was okay" },
  { rating: 4, emoji: "🙂", label: "Pretty good" },
  { rating: 5, emoji: "🤩", label: "Absolutely loved it!" },
];

/** Sentiment-matched glow for the selected emoji — never a loud, cartoonish color; always one of the existing brand/semantic tokens. */
function glowForRating(rating: number): string {
  if (rating <= 1) return "rgb(179 67 43 / 0.16)"; // --color-danger
  if (rating <= 3) return "rgb(192 138 46 / 0.16)"; // --color-gold
  return "rgb(193 97 30 / 0.18)"; // --color-verified (brand orange)
}

export interface FeedbackContextQuestion {
  id: string;
  questionText: string;
  options: string[];
}

interface FeedbackFlowProps {
  code: string;
  businessName: string;
  category: string | null;
  city: string | null;
  logoUrl: string | null;
  tags: string[];
  /** No longer rendered — kept for type compatibility with the unchanged server page and the owner's still-functional question system. */
  questions?: FeedbackContextQuestion[];
}

export function FeedbackFlow({ code, businessName, category, city, logoUrl, tags }: FeedbackFlowProps) {
  const [step, setStep] = useState<Step>("emoji");
  const [rating, setRating] = useState(0);
  const [pressedRating, setPressedRating] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedWithNoGoogleUrl, setSavedWithNoGoogleUrl] = useState(false);
  const [recoveryReason, setRecoveryReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectEmoji(selected: EmojiOption) {
    setPressedRating(selected.rating);
    setRating(selected.rating);
    // Brief pause so the tap/highlight is actually visible — not an
    // artificial loading delay, just long enough to register as feedback
    // before the screen changes, per "subtle scale/bounce... selected
    // emoji becomes clearly highlighted... immediately continue."
    setTimeout(() => {
      if (selected.rating >= 4) {
        goGenerate(selected.rating);
      } else {
        setStep("recoveryDetail");
      }
    }, 420);
  }

  function goGenerate(finalRating: number) {
    setStep("generating");
    setError(null);
    startTransition(async () => {
      const result = await generateDraft({ code, rating: finalRating, tags: [], message: "" });
      if ("error" in result) {
        setError(result.error);
        setStep("emoji");
        return;
      }
      setDraft(result.draft);

      // Copy immediately, as soon as the review exists — per "Review is
      // copied to clipboard -> Google opens," never deferred to the
      // button click. Graceful, non-blocking fallback on failure: the
      // "ready" screen below renders a manual Copy affordance instead of
      // a false "✓ Copied" claim.
      try {
        await navigator.clipboard?.writeText(result.draft);
        setCopied(true);
      } catch {
        setCopied(false);
      }
      setStep("ready");
    });
  }

  async function manualCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      // Still graceful — the text is already visible on screen to select by hand.
    }
  }

  function continueToGoogle() {
    setError(null);
    startTransition(async () => {
      const result = await submitFeedback({
        code,
        rating,
        tags: [],
        message: "",
        aiDraft: draft,
        finalDraft: draft,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.googleReviewUrl) {
        window.location.href = result.googleReviewUrl;
        return;
      }
      setSavedWithNoGoogleUrl(true);
    });
  }

  function submitRecovery(reason: string | null) {
    setError(null);
    setRecoveryReason(reason);
    startTransition(async () => {
      const result = await submitFeedback({
        code,
        rating,
        tags: reason ? [reason] : [],
        message: "",
        aiDraft: "",
        finalDraft: "",
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStep("recoveryThanks");
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Business identity — always visible */}
      <div className="flex flex-col items-center gap-2.5 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover shadow-md ring-4 ring-paper-raised"
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-semibold text-white shadow-md ring-4 ring-paper-raised"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          >
            {businessName.charAt(0)}
          </div>
        )}
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{businessName}</h1>
        {(category || city) && (
          <p className="text-xs text-slate">{[category, city].filter(Boolean).join(" · ")}</p>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {step === "emoji" && (
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-7 shadow-lg text-center">
          <p className="font-display text-xl font-semibold tracking-tight text-ink">
            How was your experience?
          </p>
          <div className="mt-7 flex justify-center gap-1 sm:gap-2">
            {EMOJI_OPTIONS.map((opt) => {
              const active = pressedRating === opt.rating;
              const dimmed = pressedRating !== null && !active;
              return (
                <button
                  key={opt.rating}
                  type="button"
                  aria-label={opt.label}
                  onClick={() => selectEmoji(opt)}
                  disabled={pressedRating !== null}
                  className={`rounded-full p-2.5 text-[2.25rem] leading-none transition-all duration-300 sm:text-5xl ${
                    active ? "scale-125" : dimmed ? "scale-90 opacity-40" : "hover:scale-110 active:scale-95"
                  }`}
                  style={active ? { background: glowForRating(opt.rating) } : undefined}
                >
                  {opt.emoji}
                </button>
              );
            })}
          </div>
          <p className="mt-5 h-5 text-sm font-medium text-ink-soft">
            {pressedRating !== null ? EMOJI_OPTIONS.find((o) => o.rating === pressedRating)?.label : "\u00A0"}
          </p>
        </div>
      )}

      {step === "generating" && (
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-7 shadow-lg text-center">
          <p className="font-display text-lg font-semibold text-ink">✨ Making your review ready…</p>
          <div className="mt-5 flex justify-center">
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-verified border-t-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {step === "ready" && !savedWithNoGoogleUrl && (
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-7 shadow-lg">
          <p className="text-center font-display text-lg font-semibold text-ink">
            Your review is ready ✨
          </p>

          <div className="mt-4 flex flex-col gap-1.5 text-sm text-verified-dark">
            <span>✓ Personalized</span>
            <span>✓ Ready for Google</span>
            {copied ? (
              <span>✓ Copied</span>
            ) : (
              <button type="button" onClick={manualCopy} className="w-fit text-left underline">
                Tap to copy your review
              </button>
            )}
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] border border-border-strong bg-paper p-4 text-sm text-ink">
            {draft}
          </div>

          <Button onClick={continueToGoogle} loading={isPending} className="mt-5 w-full" size="lg">
            Continue to Google →
          </Button>
          <p className="mt-2 text-center text-xs text-slate">
            {copied ? "Your review is already copied." : "Copy it above, then continue."}
          </p>
        </div>
      )}

      {step === "ready" && savedWithNoGoogleUrl && (
        <div className="rounded-[var(--radius-lg)] border border-verified/25 bg-verified-tint p-7 text-center shadow-lg">
          <p className="font-display text-lg font-semibold text-verified-dark">
            Your voice has been heard — thank you!
          </p>
          <p className="mt-1.5 text-sm text-verified-dark">
            Your feedback was sent directly to {businessName}.
          </p>
        </div>
      )}

      {step === "recoveryDetail" && (
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-7 shadow-lg text-center">
          <p className="font-display text-lg font-semibold text-ink">We&rsquo;d love to make this better. 💛</p>
          <p className="mt-1 text-sm text-ink-soft">What went wrong? (optional)</p>

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {tags.slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => submitRecovery(tag)}
                  disabled={isPending}
                  className="rounded-full border-2 border-border-strong bg-paper-raised px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-ink/40 hover:bg-ink/[0.03] active:scale-95 disabled:opacity-50"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => submitRecovery(null)}
            disabled={isPending}
            className="mt-5 text-sm text-slate underline disabled:opacity-50"
          >
            {isPending && recoveryReason === null ? "Sending…" : "Skip this"}
          </button>
        </div>
      )}

      {step === "recoveryThanks" && (
        <div className="rounded-[var(--radius-lg)] border border-verified/25 bg-verified-tint p-7 text-center shadow-lg">
          <p className="font-display text-lg font-semibold text-verified-dark">Thank you for telling us.</p>
          <p className="mt-1.5 text-sm text-verified-dark">
            Your feedback has been shared with the team at {businessName}.
          </p>
        </div>
      )}
    </div>
  );
}
