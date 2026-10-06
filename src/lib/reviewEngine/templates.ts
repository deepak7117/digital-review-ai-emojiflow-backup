import type { Tone } from "./types";

/**
 * Fragment pools, not finished sentences on their own. Every generated
 * reply/comment composes these with REAL data (business name, segment
 * terminology, actual tags/topics from the specific review) — never
 * standalone generic spam like "Thank you ❤️" with nothing review-specific
 * attached (see Milestone E spec section 5).
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
    ],
    negativeOpeners: [
      "Thank you for bringing this to our attention.",
      "We appreciate your feedback and take this seriously.",
      "Thank you for letting us know about this.",
    ],
    positiveClosers: [
      "We look forward to serving you again.",
      "We hope to welcome you back soon.",
      "Thank you again for your support.",
    ],
    negativeClosers: [
      "Please reach out to us directly so we can address this.",
      "We'd welcome the opportunity to discuss this further.",
      "We are committed to making this right.",
    ],
  },
  friendly: {
    positiveOpeners: [
      "Thanks so much for the kind words!",
      "We're so glad you shared this with us!",
      "This really made our day!",
    ],
    negativeOpeners: [
      "We're really sorry to hear this.",
      "Thanks for letting us know — we want to make this right.",
      "We're sorry this happened.",
    ],
    positiveClosers: [
      "Can't wait to see you again!",
      "Hope to welcome you back soon!",
      "See you next time!",
    ],
    negativeClosers: [
      "Please reach out — we'd love the chance to fix this.",
      "We'd really appreciate the chance to make this right.",
      "Let us know how we can help.",
    ],
  },
  premium: {
    positiveOpeners: [
      "We are grateful for your thoughtful feedback.",
      "Thank you for choosing to share your experience with us.",
      "It is our pleasure to receive such kind feedback.",
    ],
    negativeOpeners: [
      "We sincerely regret that your experience did not meet our standards.",
      "Please accept our apologies for this experience.",
      "We take this matter very seriously and regret the shortfall.",
    ],
    positiveClosers: [
      "We look forward to welcoming you back for another exceptional experience.",
      "It would be our privilege to serve you again.",
      "We eagerly anticipate your next visit.",
    ],
    negativeClosers: [
      "We would be honored to have the opportunity to make this right.",
      "Please allow us to personally address this with you.",
      "We remain fully committed to your satisfaction.",
    ],
  },
  warm: {
    positiveOpeners: [
      "Thank you from all of us here.",
      "We truly appreciate you sharing this.",
      "It means so much to hear this from you.",
    ],
    negativeOpeners: [
      "We're truly sorry this happened.",
      "This isn't the experience we want for you, and we're sorry.",
      "Our hearts go out to you — this isn't how we want you to feel.",
    ],
    positiveClosers: [
      "Thank you again, and we hope to see you soon.",
      "Wishing you well until next time.",
      "We're grateful to have you as part of our community.",
    ],
    negativeClosers: [
      "We'd love the chance to make this better for you.",
      "Please reach out — we truly care about making this right.",
      "We're here for you, and we want to fix this together.",
    ],
  },
};

export function formatTopicList(topics: string[]): string {
  if (topics.length === 0) return "";
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  return `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
}
