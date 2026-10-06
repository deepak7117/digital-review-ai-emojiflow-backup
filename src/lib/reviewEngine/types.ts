import type { SegmentConfig } from "@/lib/segments/types";

/**
 * AI Review Comment + Reply Generation Engine — Milestone E.
 *
 * Deterministic-first, same governing principle as every other AI-adjacent
 * module in this project (reviewDraft.ts, customerVoiceEnhancer.ts,
 * placesLookup.ts): this engine always works with zero configuration by
 * composing real input data (rating, tags, message, optional context-
 * question answers) into template fragments. A separate, optional AI layer
 * (src/lib/ai/reviewReplyEnhancer.ts) can polish the output when
 * AI_PROVIDER_API_KEY is configured — that has NOT run against a live key
 * in this environment, see the Milestone E report.
 */

export type Tone = "professional" | "friendly" | "premium" | "warm";

/** One real, already-collected answer to an owner-configured context question (see business_context_questions). */
export interface ContextAnswer {
  question: string;
  answer: string;
}

export interface ReviewContext {
  businessName: string;
  /** null = no segment selected; the engine still works, using generic vocabulary. */
  segmentConfig: SegmentConfig | null;
  rating: number;
  tags: string[];
  message: string | null;
  /**
   * Optional evidence from the owner's 2 context questions (Module 7
   * Milestone E). Never required — every generation path works identically
   * with an empty array. When present, used only to reference what the
   * customer actually answered, never to infer anything beyond it.
   */
  contextAnswers?: ContextAnswer[];
}

export type Sentiment = "positive" | "mixed" | "negative";
export type ReviewType = "praise" | "mixed" | "complaint";
export type Urgency = "low" | "medium" | "high";
export type EmotionalTone = "delighted" | "satisfied" | "neutral" | "frustrated" | "upset";

export interface ReviewIntelligence {
  sentiment: Sentiment;
  rating: number;
  reviewType: ReviewType;
  /** Tags classified as positive for THIS review — derived from segment config + rating, never invented. */
  positiveTopics: string[];
  negativeTopics: string[];
  urgency: Urgency;
  emotionalTone: EmotionalTone;
  /** 0-1: how much real signal (tags + message + context answers) this analysis is grounded in — not a claim of NLP certainty. */
  confidence: number;
}

export interface ComplianceCheckItem {
  label: string;
  passed: boolean;
}

export interface ComplianceResult {
  passed: boolean;
  checks: ComplianceCheckItem[];
}

export interface QualityFactor {
  label: string;
  contribution: number;
  detail: string;
}

export interface QualityScoreResult {
  score: number;
  factors: QualityFactor[];
}

export type ReplyVariant = "recommended" | "alternativeA" | "alternativeB" | "short" | "detailed";

export interface GeneratedReply {
  text: string;
  variant: ReplyVariant;
  tone: Tone;
  compliance: ComplianceResult;
  quality: QualityScoreResult;
}

export interface GeneratedReplySet {
  intelligence: ReviewIntelligence;
  recommended: GeneratedReply;
  alternativeA: GeneratedReply;
  alternativeB: GeneratedReply;
  short: GeneratedReply;
  detailed: GeneratedReply;
}

export type CommentType =
  | "appreciation"
  | "thank_you"
  | "complaint_acknowledgement"
  | "service_recovery"
  | "follow_up";

export interface GeneratedComment {
  text: string;
  commentType: CommentType;
  tone: Tone;
  compliance: ComplianceResult;
  quality: QualityScoreResult;
}
