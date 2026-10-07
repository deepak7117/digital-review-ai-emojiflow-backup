"use server";

import { createClient } from "@/lib/supabase/server";
import { generateFeedbackCode } from "@/lib/utils/slug";
import { revalidatePath } from "next/cache";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

export interface PollWithResults {
  id: string;
  publicCode: string;
  question: string;
  options: string[];
  isActive: boolean;
  createdAt: string;
  totalResponses: number;
  optionCounts: number[];
}

async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ businessId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You need to be logged in." };

  const { business } = await getActiveBusiness(supabase);
  if (!business) return { error: "Set up your business profile first." };

  return { businessId: business.id };
}

const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;
const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LENGTH = 60;

export async function createPoll(input: {
  question: unknown;
  options: unknown;
}): Promise<{ data: { publicCode: string } } | { error: string }> {
  const question = typeof input.question === "string" ? input.question.trim().slice(0, MAX_QUESTION_LENGTH) : "";
  if (!question) return { error: "Enter a question." };

  const rawOptions = Array.isArray(input.options) ? input.options : [];
  const options = rawOptions
    .filter((o): o is string => typeof o === "string")
    .map((o) => o.trim().slice(0, MAX_OPTION_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);

  if (options.length < MIN_OPTIONS) return { error: `Add at least ${MIN_OPTIONS} options.` };

  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("id", owned.businessId)
    .single();

  for (let attempt = 0; attempt < 5; attempt++) {
    const publicCode = generateFeedbackCode(`${business?.business_name ?? "poll"}-pulse`);
    const insert = await supabase
      .from("customer_pulse_polls")
      .insert({ business_id: owned.businessId, public_code: publicCode, question, options })
      .select("public_code")
      .single();

    if (!insert.error && insert.data) {
      revalidatePath("/dashboard/pulse");
      return { data: { publicCode: insert.data.public_code } };
    }
    if (insert.error && insert.error.code !== "23505") {
      return { error: insert.error.message };
    }
  }

  return { error: "Couldn't create the poll right now. Please try again." };
}

export async function setPollActive(
  pollId: unknown,
  isActive: unknown
): Promise<{ ok: true } | { error: string }> {
  if (typeof pollId !== "string" || typeof isActive !== "boolean") {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabase
    .from("customer_pulse_polls")
    .update({ is_active: isActive })
    .eq("id", pollId)
    .eq("business_id", owned.businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/pulse");
  return { ok: true };
}
