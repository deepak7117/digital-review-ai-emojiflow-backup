import "server-only";

/**
 * AI Customer Brain — enhancement boundary (Module 6).
 *
 * This module is intentionally thin and strictly additive. It CANNOT
 * change any count, evidence, or priority the deterministic engines
 * (customerVoice.ts, demandDetector.ts, experienceScore.ts,
 * businessAdvisor.ts) already computed — it can only add a short natural-
 * language narrative on top of insights that already have real evidence.
 *
 * Architectural rule this exists to enforce: if this module returns a
 * classification or a topic, the CALLER is responsible for turning that
 * into an Insight by actually counting matching rows — never by trusting
 * a count the model reports. This file has no way to write a fabricated
 * number into the product, because it has no access to evidence counts at
 * all; it only ever receives already-computed Insight[]/RecommendedAction[]
 * data and returns prose.
 *
 * Configuration: reuses AI_PROVIDER_API_KEY (the same variable Module 2's
 * AI Review Assistant uses). Unset here — every call below returns null,
 * and callers must render an honest "AI narrative not configured" state,
 * never a fake summary. This has NOT been exercised against a live key in
 * this environment (see Module 6 report).
 */

import type { Insight, RecommendedAction } from "@/lib/insights/types";

export function isCustomerBrainAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY);
}

/**
 * Produces a short, evidence-grounded narrative summary of the business's
 * current insights — e.g. "Customers are loving your service, but repeated
 * cleanliness complaints need attention." The model is given ONLY the
 * already-computed labels/counts/trends (never raw customer text with any
 * possibility of PII), and is instructed to summarize, not invent.
 *
 * Returns null if not configured, if there's nothing to summarize, or if
 * the call fails for any reason — callers must fail closed to "no AI
 * summary available" rather than showing a stale or fabricated one.
 */
export async function generateAdvisorNarrative(
  actions: RecommendedAction[]
): Promise<string | null> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey || actions.length === 0) return null;

  const systemPrompt = [
    "You write a 2-3 sentence executive summary for a small business owner,",
    "based ONLY on the prioritized action list you are given below.",
    "You must NEVER introduce a fact, number, or claim that is not already",
    "present in the list. You must NEVER invent customer counts.",
    "Every number you use must come directly from the list provided.",
    "Plain, direct, encouraging but honest tone. No preamble, return only the summary.",
  ].join(" ");

  const userPrompt = actions
    .slice(0, 5)
    .map((a) => `Priority ${a.priority}: ${a.title} — ${a.why}`)
    .join("\n");

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
    return null;
  }
}

/**
 * Placeholder for a future free-text topic-clustering pass over
 * unmet_demand_reports.detail / feedback_submissions.message (e.g.
 * grouping "wanted XL", "need bigger sizes", "do you have a large" into one
 * "larger sizes" demand signal instead of three separate literal strings).
 *
 * NOT implemented in Module 6 — the deterministic Demand Detector only
 * groups by the fixed reason enum customers explicitly selected, which is
 * the honest boundary of what's possible without real NLP (see
 * demandDetector.ts's module comment). This function documents the exact
 * shape a future implementation must have to stay safe: it classifies
 * (returns topic *labels*, not counts), and the caller must independently
 * count how many rows matched each returned label before treating it as
 * evidence.
 */
export async function classifyDemandTopics(
  _rawTexts: string[]
): Promise<{ text: string; suggestedTopic: string }[] | null> {
  // Deliberately unimplemented — see doc comment. Always returns null so
  // any future caller fails closed rather than silently getting nothing
  // useful and mistaking it for "no demand signals exist".
  void _rawTexts;
  return null;
}

// Re-exported so callers can type-check against the same Insight shape
// this module's future output must conform to.
export type { Insight };
