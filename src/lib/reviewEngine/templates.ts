import type { Tone } from "./types";

/**
 * Fragment pools, not finished sentences on their own. Every generated
 * reply/comment composes these with REAL data (business name, segment
 * terminology, actual tags/topics from the specific review) — never
 * standalone generic spam like "Thank you ❤️" with nothing review-specific
 * attached (see Milestone E spec section 5).
 *
 * Phase 4: expanded from 3 to 6 entries per array specifically so that
 * "Regenerate" (now seeded by genuine per-call randomness rather than a
 * deterministic hash of the submission id — see generationActions.ts and
 * reviewDraft.ts) has real room to produce a meaningfully different
 * result, not just cycle through the same 3 options repeatedly.
 */

export interface TonePool {
  positiveOpeners: string[];
  negativeOpeners: string[];
  positiveClosers: string[];
  negativeClosers: string[];
}

export const TONE_POOLS: Record<Tone, TonePool> = {
  professional: {
    positiveOpeners: [
      "Thank you for sharing your feedback.",
      "We appreciate you taking the time to review your experience.",
      "Thank you for your review.",
      "We're grateful you took a moment to share your thoughts.",
      "Thank you for letting us know how your visit went.",
      "We value the time you took to leave this feedback.",
    ],
    negativeOpeners: [
      "Thank you for bringing this to our attention.",
      "We appreciate your feedback and take this seriously.",
      "Thank you for letting us know about this.",
      "We're grateful you flagged this for us directly.",
      "Thank you for the honest feedback — it matters to us.",
      "We take matters like this seriously and appreciate you sharing it.",
    ],
    positiveClosers: [
      "We look forward to serving you again.",
      "We hope to welcome you back soon.",
      "Thank you again for your support.",
      "We look forward to your next visit.",
      "Thank you for being a valued customer.",
      "We hope to see you again before long.",
    ],
    negativeClosers: [
      "Please reach out to us directly so we can address this.",
      "We'd welcome the opportunity to discuss this further.",
      "We are committed to making this right.",
      "Please contact us so we can resolve this properly.",
      "We'd appreciate the chance to put this right.",
      "We remain committed to addressing this with you directly.",
    ],
  },
  friendly: {
    positiveOpeners: [
      "Thanks so much for the kind words!",
      "We're so glad you shared this with us!",
      "This really made our day!",
      "Thanks a ton for taking the time to write this!",
      "We're so happy to hear this!",
      "This put a smile on our faces!",
    ],
    negativeOpeners: [
      "We're really sorry to hear this.",
      "Thanks for letting us know — we want to make this right.",
      "We're sorry this happened.",
      "Oh no, we're really sorry about this.",
      "Thanks for flagging this — we really appreciate it.",
      "We hate to hear this, and we're sorry.",
    ],
    positiveClosers: [
      "Can't wait to see you again!",
      "Hope to welcome you back soon!",
      "See you next time!",
      "Can't wait for your next visit!",
      "Thanks again — see you soon!",
      "We'll be here whenever you're ready to come back!",
    ],
    negativeClosers: [
      "Please reach out — we'd love the chance to fix this.",
      "We'd really appreciate the chance to make this right.",
      "Let us know how we can help.",
      "Reach out anytime — we really want to make this better.",
      "We're here to help make this right, just let us know.",
      "Please give us a shout so we can fix this for you.",
    ],
  },
  premium: {
    positiveOpeners: [
      "We are grateful for your thoughtful feedback.",
      "Thank you for choosing to share your experience with us.",
      "It is our pleasure to receive such kind feedback.",
      "We are delighted to receive your thoughtful review.",
      "Thank you for taking the time to share such kind words.",
      "We are truly honored by your feedback.",
    ],
    negativeOpeners: [
      "We sincerely regret that your experience did not meet our standards.",
      "Please accept our apologies for this experience.",
      "We take this matter very seriously and regret the shortfall.",
      "We are genuinely sorry your experience fell short of our standards.",
      "Please accept our sincere apologies for this experience.",
      "We deeply regret that this did not reflect the standard we hold ourselves to.",
    ],
    positiveClosers: [
      "We look forward to welcoming you back for another exceptional experience.",
      "It would be our privilege to serve you again.",
      "We eagerly anticipate your next visit.",
      "We look forward to the pleasure of serving you again.",
      "It would be our honor to welcome you back.",
      "We await your next visit with great anticipation.",
    ],
    negativeClosers: [
      "We would be honored to have the opportunity to make this right.",
      "Please allow us to personally address this with you.",
      "We remain fully committed to your satisfaction.",
      "We would welcome the opportunity to make this right, personally.",
      "Please allow us the opportunity to restore your confidence in us.",
      "We remain devoted to resolving this to your complete satisfaction.",
    ],
  },
  warm: {
    positiveOpeners: [
      "Thank you from all of us here.",
      "We truly appreciate you sharing this.",
      "It means so much to hear this from you.",
      "This really warms our hearts — thank you.",
      "We're so thankful you took the time to share this.",
      "Thank you, truly, for these kind words.",
    ],
    negativeOpeners: [
      "We're truly sorry this happened.",
      "This isn't the experience we want for you, and we're sorry.",
      "Our hearts go out to you — this isn't how we want you to feel.",
      "We're genuinely sorry to hear this happened to you.",
      "This really isn't the experience we hoped you'd have, and we're sorry.",
      "We feel for you, and we're sorry this happened.",
    ],
    positiveClosers: [
      "Thank you again, and we hope to see you soon.",
      "Wishing you well until next time.",
      "We're grateful to have you as part of our community.",
      "Thank you again — we can't wait to see you next time.",
      "Sending our thanks and warm wishes until we see you again.",
      "We're so grateful to have you with us.",
    ],
    negativeClosers: [
      "We'd love the chance to make this better for you.",
      "Please reach out — we truly care about making this right.",
      "We're here for you, and we want to fix this together.",
      "We'd be so grateful for the chance to make this right.",
      "Please know we truly care, and we'd love to fix this together.",
      "We're here for you — let's make this right together.",
    ],
  },
};

export function formatTopicList(topics: string[]): string {
  if (topics.length === 0) return "";
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  return `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
}
