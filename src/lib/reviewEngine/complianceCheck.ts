import type { ComplianceResult } from "./types";

/**
 * Deterministic, rule-based approximation of Google's review-response
 * guidance (no external API call — nothing here claims to be Google's own
 * validator). Catches the concrete, checkable failure modes the Milestone
 * E spec lists: PII, insults, incentive language, excessive promotion,
 * unreasonable length, shouting. This is intentionally NOT exhaustive
 * (e.g. it cannot detect a subtly misleading claim) — documented as a
 * known limitation, not oversold as complete moderation.
 */

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

// Small, deliberately conservative list — flags obvious cases without
// trying to be a full profanity filter.
const INSULT_WORDS = ["stupid", "idiot", "liar", "scam", "fraud", "pathetic"];

const INCENTIVE_PATTERNS = [
  /free (discount|gift|item)/i,
  /\bpost(ing)?\s+(a\s+)?positive review\b/i,
  /\bleave\s+(a\s+)?5[\s-]?star\b/i,
  /\bin exchange for\b/i,
];

const EXCESSIVE_PROMO_PATTERN =
  /\b(buy now|limited time offer|click here|visit our website for a discount|use code)\b/i;

function isShouting(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length > 10 && letters === letters.toUpperCase();
}

export function checkCompliance(text: string): ComplianceResult {
  const checks = [
    { label: "No email or phone number shared", passed: !EMAIL_PATTERN.test(text) && !PHONE_PATTERN.test(text) },
    {
      label: "No insulting language",
      passed: !INSULT_WORDS.some((w) => text.toLowerCase().includes(w)),
    },
    {
      label: "No review-incentive language",
      passed: !INCENTIVE_PATTERNS.some((p) => p.test(text)),
    },
    { label: "No excessive promotional language", passed: !EXCESSIVE_PROMO_PATTERN.test(text) },
    { label: "Reasonable length (20–700 characters)", passed: text.length >= 20 && text.length <= 700 },
    { label: "Not written in all caps", passed: !isShouting(text) },
  ];

  return { passed: checks.every((c) => c.passed), checks };
}
