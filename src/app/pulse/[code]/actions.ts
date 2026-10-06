"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIpHash } from "@/lib/utils/rateLimit";

const VOTE_RATE_LIMIT = { maxCount: 10, windowSeconds: 600 }; // 10 / 10 min per (ip, poll)

export async function submitVote(
  code: unknown,
  optionIndex: unknown
): Promise<{ ok: true } | { error: string }> {
  if (typeof code !== "string" || !code.trim()) {
    return { error: "Missing poll." };
  }
  const index = Number(optionIndex);
  if (!Number.isInteger(index) || index < 0) {
    return { error: "Invalid option." };
  }

  const supabase = await createClient();

  const ipHash = await getClientIpHash();
  const allowed = await checkRateLimit(
    supabase,
    "pulse-vote",
    `${ipHash}:${code}`,
    VOTE_RATE_LIMIT.maxCount,
    VOTE_RATE_LIMIT.windowSeconds
  );
  if (!allowed) {
    return { error: "Too many votes from this connection. Please try again later." };
  }

  // Resolve the poll purely from the public code — never trust a poll id
  // supplied by the client. This mirrors feedback_links resolution from
  // Module 2's submitFeedback.
  const { data: poll, error: pollError } = await supabase
    .from("customer_pulse_polls")
    .select("id, options, is_active")
    .eq("public_code", code)
    .maybeSingle();

  if (pollError) return { error: "Something went wrong. Please try again." };
  if (!poll || !poll.is_active) {
    return { error: "This poll is no longer available." };
  }
  if (index >= poll.options.length) {
    return { error: "Invalid option." };
  }

  const { error: insertError } = await supabase
    .from("customer_pulse_responses")
    .insert({ poll_id: poll.id, option_index: index });

  if (insertError) {
    return { error: "We couldn't save your vote. Please try again." };
  }

  return { ok: true };
}
