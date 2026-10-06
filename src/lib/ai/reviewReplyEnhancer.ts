import "server-only";

/**
 * AI Review Reply enhancement — optional layer (Milestone E).
 *
 * Mirrors src/lib/ai/reviewDraft.ts and src/lib/ai/customerVoiceEnhancer.ts
 * exactly: the deterministic engine (replyGenerator.ts / commentGenerator.ts)
 * always works with zero configuration. This module can polish that output
 * for phrasing/naturalness ONLY — it receives the already-composed
 * template reply as its input and is instructed to never add a new claim,
 * topic, or fact beyond what's already in that text. It cannot fabricate a
 * customer experience because it never receives (or is asked to invent)
 * anything beyond polishing already-grounded text.
 *
 * Configuration: reuses AI_PROVIDER_API_KEY (same variable as every other
 * AI feature in this project). Unset in this environment — every call
 * below returns null, and callers must show the deterministic reply as-is
 * rather than a fabricated "AI-enhanced" version. This has NOT been
 * exercised against a live key — see the Milestone E report.
 */

import type { ReviewContext, Tone } from "@/lib/reviewEngine/types";

export function isReviewReplyAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY);
}

export async function enhanceReplyWithAi(
  context: ReviewContext,
  templateReply: string,
  tone: Tone
): Promise<string | null> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = [
    "You lightly copyedit a business's draft reply to a customer review for natural phrasing and tone.",
    "You may ONLY improve grammar, flow, and warmth — you must NEVER add a new fact, claim, topic, promise, or detail that is not already in the draft you are given.",
    "You must NEVER mention or offer any incentive for reviews, never claim SEO/ranking benefits, never include any contact details, and never argue with or blame the customer.",
    `Write in a ${tone} tone.`,
    "Return ONLY the rewritten reply, nothing else — no quotes, no preamble.",
  ].join(" ");

  const userPrompt = `Business: ${context.businessName}\nStar rating: ${context.rating}/5\nTags: ${
    context.tags.join(", ") || "none"
  }\nDraft reply to lightly copyedit:\n${templateReply}`;

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
        max_tokens: 300,
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
    return null;
  }
}
