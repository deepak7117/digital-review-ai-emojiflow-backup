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
type Step = "emoji" | "signals" | "generating" | "ready" | "recoveryDetail" | "recoveryThanks";

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

/**
 * Sentiment-matched glow for the selected emoji — never a loud,
 * cartoonish color; always one of the semantic tokens. The emoji
 * represents the CUSTOMER's own feeling, not BD Clarity's AI, so a
 * positive rating glows Emerald/success — not Indigo, which is reserved
 * for BD Clarity's own intelligence, shown next on the generating step.
 */
function glowForRating(rating: number): string {
  if (rating <= 1) return "rgb(179 67 43 / 0.16)"; // --color-danger
  if (rating <= 3) return "rgb(192 138 46 / 0.16)"; // --color-gold
  return "rgb(22 145 95 / 0.16)"; // --color-success (Emerald)
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
  // Lightweight "What stood out?" multi-select — positive flow only.
  // Reuses the SAME segment-aware tags vocabulary already used for the
  // negative-flow recovery step; not a new/second category system.
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  // Regeneration counter — only increments on the customer's own
  // explicit "Regenerate" tap, never automatically. See the matching
  // comment in reviewDraft.ts's DraftInput.
  const [attempt, setAttempt] = useState(0);

  function selectEmoji(selected: EmojiOption) {
    setPressedRating(selected.rating);
    setRating(selected.rating);
    // Brief pause so the tap/highlight is actually visible — not an
    // artificial loading delay, just long enough to register as feedback
    // before the screen changes, per "subtle scale/bounce... selected
    // emoji becomes clearly highlighted... immediately continue."
    setTimeout(() => {
      if (selected.rating >= 4) {
        setStep("signals");
      } else {
        setStep("recoveryDetail");
      }
    }, 420);
  }

  function toggleSignal(tag: string) {
    setSelectedSignals((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function goGenerate(nextAttempt: number) {
    setStep("generating");
    setError(null);
    startTransition(async () => {
      const result = await generateDraft({
        code,
        rating,
        tags: selectedSignals,
        message: "",
        attempt: nextAttempt,
      });
      if ("error" in result) {
        setError(result.error);
        setStep(nextAttempt === 0 ? "signals" : "ready");
        return;
      }
      setDraft(result.draft);
      setAttempt(nextAttempt);

      // Copy immediately, as soon as the review exists — per "Review is
      // copied to clipboard -> Google opens," never deferred to the
      // button click. Graceful, non-blocking fallback on failure: the
      // "ready" screen below renders a manual Copy affordance instead of
      // a false "✓ Copied" claim. Re-attempted on every regeneration too
      // — the newest draft is always the one that gets copied.
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
        tags: selectedSignals,
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

      {step === "signals" && (
        <div className="rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-7 shadow-lg text-center">
          <p className="font-display text-xl font-semibold tracking-tight text-ink">What stood out?</p>
          <p className="mt-1 text-sm text-ink-soft">Optional — pick as many as apply.</p>

          {tags.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {tags.slice(0, 6).map((tag) => {
                const active = selectedSignals.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSignal(tag)}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95 ${
                      active
                        ? "border-success bg-success text-white shadow-sm"
                        : "border-border-strong bg-paper-raised text-ink-soft hover:border-ink/40 hover:bg-ink/[0.03]"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          <Button onClick={() => goGenerate(0)} loading={isPending} className="mt-6 w-full" size="lg">
            Continue
          </Button>
          {selectedSignals.length === 0 && (
            <button
              type="button"
              onClick={() => goGenerate(0)}
              disabled={isPending}
              className="mt-3 text-sm text-slate underline disabled:opacity-50"
            >
              Skip this
            </button>
          )}
        </div>
      )}

      {step === "generating" && (
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-verified/20 bg-paper-raised p-7 text-center shadow-lg">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          />
          <div className="relative flex justify-center">
            <span
              className="h-9 w-9 animate-spin rounded-full border-2 border-verified border-t-transparent"
              aria-hidden="true"
            />
          </div>
          <p className="relative mt-4 font-display text-lg font-semibold text-ink">
            Understanding your experience…
          </p>
          <p className="relative mt-1 text-sm text-verified-dark">
            BD Clarity is reading between the lines ✨
          </p>
        </div>
      )}

      {step === "ready" && !savedWithNoGoogleUrl && (
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-verified/20 bg-paper-raised p-7 shadow-lg">
          {/* A restrained top accent, not a full gradient card — "AI result
              highlight" per the gradient rule, applied once, not everywhere. */}
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          />

          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-verified-dark">
            <span aria-hidden="true">✨</span>
            BD Clarity understood your experience
          </div>
          <p className="mt-1.5 text-center font-display text-xl font-semibold tracking-tight text-ink">
            Your review is ready
          </p>

          <div className="mt-4 flex flex-col gap-1.5 text-sm text-success-dark">
            <span>✓ Personalized to what you shared</span>
            <span>✓ Ready for Google</span>
            {copied ? (
              <span>✓ Copied</span>
            ) : (
              <button
                type="button"
                onClick={manualCopy}
                className="w-fit text-left text-verified-dark underline"
              >
                Tap to copy your review
              </button>
            )}
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] border border-verified/15 bg-verified-tint/40 p-4 text-sm leading-relaxed text-ink">
            {draft}
          </div>

          <button
            type="button"
            onClick={() => goGenerate(attempt + 1)}
            disabled={isPending}
            className="mt-2 text-xs font-medium text-verified-dark underline disabled:opacity-50"
          >
            Regenerate
          </button>

          <Button
            onClick={continueToGoogle}
            loading={isPending}
            className="mt-5 w-full shadow-premium"
            size="lg"
            style={{ background: "var(--gradient-brand)" }}
          >
            Continue to Google →
          </Button>
          <p className="mt-2 text-center text-xs text-slate">
            {copied ? "Your review is already copied." : "Copy it above, then continue."}
          </p>
        </div>
      )}

      {step === "ready" && savedWithNoGoogleUrl && (
        <div className="rounded-[var(--radius-lg)] border border-success/25 bg-success-tint p-7 text-center shadow-lg">
          <p className="font-display text-lg font-semibold text-success-dark">
            Your voice has been heard — thank you!
          </p>
          <p className="mt-1.5 text-sm text-success-dark">
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
        <div className="rounded-[var(--radius-lg)] border border-success/25 bg-success-tint p-7 text-center shadow-lg">
          <p className="font-display text-lg font-semibold text-success-dark">Thank you for telling us.</p>
          <p className="mt-1.5 text-sm text-success-dark">
            Your feedback has been shared with the team at {businessName}.
          </p>
        </div>
      )}
    </div>
  );
}
