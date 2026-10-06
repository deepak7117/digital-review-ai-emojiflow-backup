/**
 * AI Review Assistant — integration boundary.
 *
 * This is the ONLY place that talks to an AI provider. It is deliberately
 * small and swappable: nothing else in the app should know or care whether
 * a draft came from a template or a model call.
 *
 * Hard rule, enforced by construction: a draft may only ever be built from
 * what the caller passes in (rating, tags, message). This module never adds
 * facts, experiences, or claims of its own, and the AI prompt below
 * explicitly forbids the model from doing so too.
 *
 * Configuration:
 *   - AI_PROVIDER_API_KEY unset (default in this environment): every draft
 *     is produced by the deterministic template below. This always works,
 *     requires no configuration, and is honest about not being AI-written.
 *   - AI_PROVIDER_API_KEY set to an Anthropic API key: drafts are lightly
 *     polished for grammar and flow by the model, still grounded only in
 *     the supplied rating/tags/message. If the call fails for any reason,
 *     this silently falls back to the template so the flow never breaks.
 *
 * Tone (Module 3): callers may pass tone: "neutral" | "detailed" | "brief".
 * This only ever changes phrasing/length, never content — see DraftInput.
 *
 * Context-question answers (Module 7 Milestone F): callers may optionally
 * pass `contextAnswers` — real answers to the business's up-to-2 active
 * context questions (see business_context_questions). These are additional
 * customer-provided evidence, exactly like `message`: never required, and
 * generation works identically well without them. When present, they are
 * quoted/paraphrased only from the answer text actually given — never
 * expanded or interpreted into something the customer didn't say.
 *
 * TODO before relying on the AI path in production: set AI_PROVIDER_API_KEY,
 * confirm the model name below is still current, and add rate limiting /
 * abuse protection to the server action that calls this (a single public
 * endpoint calling an LLM per request is a cost/abuse surface). Rate
 * limiting for the calling server actions was added in Module 2 hardening
 * (see src/lib/utils/rateLimit.ts) — this note is about the AI call itself
 * specifically, which is additionally covered by that same limit.
 */

export interface DraftContextAnswer {
  question: string;
  answer: string;
}

export interface DraftInput {
  rating: number;
  tags: string[];
  message: string;
  /**
   * Phrasing style only — never changes what's said, only how. Defaults to
   * "neutral" so existing callers that don't pass this keep working
   * unchanged. Deliberately no "enthusiastic"/"positive" option: forcing an
   * upbeat register onto a low rating would fight the rating's own honesty,
   * which conflicts with this project's core anti-manipulation principle.
   */
  tone?: "neutral" | "detailed" | "brief";
  /** Optional — real answers to the business's context questions, if any were collected. See module doc comment above. */
  contextAnswers?: DraftContextAnswer[];
}

export interface DraftResult {
  draft: string;
  source: "template" | "ai";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY);
}

/** Builds a draft purely by composing the customer's own inputs. No model, no invention. */
function buildTemplateDraft({ rating, tags, message, tone = "neutral", contextAnswers = [] }: DraftInput): string {
  const sentiment =
    rating >= 5
      ? "Overall it was a great experience."
      : rating === 4
        ? "Overall it was a good experience."
        : rating === 3
          ? "Overall it was an okay experience."
          : rating === 2
            ? "Overall it wasn't a great experience."
            : "Overall it was a disappointing experience.";

  const answeredContext = contextAnswers.filter((a) => a.answer.trim());

  if (tone === "brief") {
    // Shortest honest summary: sentiment plus at most the tags, no message/context body.
    const bits: string[] = [];
    if (tags.length > 0) bits.push(tags.join(", ").toLowerCase());
    return bits.length > 0 ? `${sentiment} (${bits.join(", ")})` : sentiment;
  }

  const parts: string[] = [];

  if (tags.length > 0) {
    parts.push(
      tone === "detailed"
        ? `The things that stood out most were: ${tags.join(", ")}.`
        : `Standout points: ${tags.join(", ")}.`
    );
  }

  if (message.trim()) {
    parts.push(message.trim());
  }

  // Context-question answers are additional real evidence the customer
  // gave — appended plainly as their own words, never reinterpreted.
  for (const a of answeredContext) {
    parts.push(a.answer.trim());
  }

  parts.push(sentiment);

  return parts.join(" ");
}

/** Optional: ask the model to polish phrasing only, never to add content. */
async function polishWithAi(input: DraftInput, templateDraft: string): Promise<string | null> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) return null;

  const tone = input.tone ?? "neutral";
  const toneInstruction =
    tone === "brief"
      ? "Keep it to a single short sentence."
      : tone === "detailed"
        ? "You may use up to 4 short sentences, but still add no new content."
        : "Keep it to 1-3 short sentences.";

  const systemPrompt = [
    "You lightly copyedit short customer review drafts for a local business.",
    "You may ONLY improve grammar, punctuation, and natural flow.",
    "You must NEVER add a fact, claim, experience, compliment, complaint, or detail that was not already present in the draft you were given.",
    "You must NEVER change the star rating's sentiment, and must NEVER make a low rating sound more positive than the customer's own words.",
    toneInstruction,
    "First person, natural spoken tone.",
    "Return ONLY the rewritten text, nothing else — no quotes, no preamble.",
  ].join(" ");

  const contextLines = (input.contextAnswers ?? [])
    .filter((a) => a.answer.trim())
    .map((a) => `${a.question}: ${a.answer}`)
    .join("\n");

  const userPrompt = `Star rating: ${input.rating}/5\nTags selected: ${
    input.tags.join(", ") || "none"
  }${contextLines ? `\nAdditional answers the customer gave:\n${contextLines}` : ""}\nDraft to lightly copyedit:\n${templateDraft}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = Array.isArray(data?.content)
      ? data.content.find((b: { type: string }) => b.type === "text")?.text
      : null;

    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    // Network/config issue — fail closed to the template draft.
    return null;
  }
}

export async function generateReviewDraft(input: DraftInput): Promise<DraftResult> {
  const template = buildTemplateDraft(input);

  if (!isAiConfigured()) {
    return { draft: template, source: "template" };
  }

  const polished = await polishWithAi(input, template);
  return polished ? { draft: polished, source: "ai" } : { draft: template, source: "template" };
}
