"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getSegmentConfig } from "@/lib/segments/engine";

export interface ContextQuestion {
  id: string;
  questionText: string;
  options: string[];
  sortOrder: number;
  isActive: boolean;
}

const MAX_ACTIVE_QUESTIONS = 2;
const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LENGTH = 60;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

async function getOwnedBusiness(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ businessId: string; industrySlug: string | null; segmentSlug: string | null } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, industry_slug, segment_slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!business) return { error: "Set up your business profile first." };

  return { businessId: business.id, industrySlug: business.industry_slug, segmentSlug: business.segment_slug };
}

function sanitizeOptions(rawOptions: unknown): string[] {
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  return options
    .filter((o): o is string => typeof o === "string")
    .map((o) => o.trim().slice(0, MAX_OPTION_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);
}

function toContextQuestion(row: {
  id: string;
  question_text: string;
  options: string[];
  sort_order: number;
  is_active: boolean;
}): ContextQuestion {
  return {
    id: row.id,
    questionText: row.question_text,
    options: row.options,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

/**
 * Returns the caller's business's context questions, lazily seeding up to 2
 * sensible defaults from the segment registry the FIRST time this is
 * called for a business with none yet. The registry
 * (src/lib/segments/registry.ts) remains the single source of default
 * text — this only ever copies it into the business's own row once, never
 * duplicating it as a second static system. A business with no segment
 * gets a small generic default pair instead of segment-specific text.
 */
export async function listContextQuestions(): Promise<
  { data: ContextQuestion[] } | { error: string }
> {
  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };

  const existing = await supabase
    .from("business_context_questions")
    .select("id, question_text, options, sort_order, is_active")
    .eq("business_id", owned.businessId)
    .order("sort_order", { ascending: true });

  if (existing.error) return { error: existing.error.message };
  if (existing.data && existing.data.length > 0) {
    return { data: existing.data.map(toContextQuestion) };
  }

  const segmentConfig =
    owned.industrySlug && owned.segmentSlug ? getSegmentConfig(owned.industrySlug, owned.segmentSlug) : null;

  const defaults = segmentConfig?.pulseQuestionTemplates.slice(0, MAX_ACTIVE_QUESTIONS) ?? [];
  const seedTemplates =
    defaults.length > 0
      ? defaults
      : [{ question: "How was your experience?", options: ["Excellent", "Good", "Average", "Poor"] }];

  const seeded = await supabase
    .from("business_context_questions")
    .insert(
      seedTemplates.map((t, i) => ({
        business_id: owned.businessId,
        question_text: t.question,
        options: t.options.slice(0, MAX_OPTIONS),
        sort_order: i,
      }))
    )
    .select("id, question_text, options, sort_order, is_active");

  if (seeded.error) return { error: seeded.error.message };
  return { data: (seeded.data ?? []).map(toContextQuestion) };
}

export async function createContextQuestion(
  questionText: unknown,
  rawOptions: unknown
): Promise<{ data: ContextQuestion } | { error: string }> {
  const text = typeof questionText === "string" ? questionText.trim().slice(0, MAX_QUESTION_LENGTH) : "";
  if (!text) return { error: "Enter a question." };

  const options = sanitizeOptions(rawOptions);
  if (options.length < MIN_OPTIONS) return { error: `Add at least ${MIN_OPTIONS} options.` };

  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };

  const { count } = await supabase
    .from("business_context_questions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", owned.businessId)
    .eq("is_active", true);

  if ((count ?? 0) >= MAX_ACTIVE_QUESTIONS) {
    return { error: `You can have at most ${MAX_ACTIVE_QUESTIONS} active questions. Deactivate one first.` };
  }

  const { data: maxSort } = await supabase
    .from("business_context_questions")
    .select("sort_order")
    .eq("business_id", owned.businessId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insert = await supabase
    .from("business_context_questions")
    .insert({
      business_id: owned.businessId,
      question_text: text,
      options,
      sort_order: (maxSort?.sort_order ?? -1) + 1,
    })
    .select("id, question_text, options, sort_order, is_active")
    .single();

  if (insert.error) return { error: insert.error.message };

  revalidatePath("/dashboard/profile");
  return { data: toContextQuestion(insert.data) };
}

export async function updateContextQuestion(
  id: unknown,
  updates: { questionText?: unknown; options?: unknown; isActive?: unknown }
): Promise<{ data: ContextQuestion } | { error: string }> {
  if (typeof id !== "string" || !id) return { error: "Invalid question." };

  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };

  const patch: { question_text?: string; options?: string[]; is_active?: boolean } = {};

  if (updates.questionText !== undefined) {
    const text = typeof updates.questionText === "string" ? updates.questionText.trim().slice(0, MAX_QUESTION_LENGTH) : "";
    if (!text) return { error: "Question text cannot be empty." };
    patch.question_text = text;
  }
  if (updates.options !== undefined) {
    const options = sanitizeOptions(updates.options);
    if (options.length < MIN_OPTIONS) return { error: `Add at least ${MIN_OPTIONS} options.` };
    patch.options = options;
  }
  if (updates.isActive !== undefined) {
    patch.is_active = Boolean(updates.isActive);
  }

  const { data, error } = await supabase
    .from("business_context_questions")
    .update(patch)
    .eq("id", id)
    .eq("business_id", owned.businessId)
    .select("id, question_text, options, sort_order, is_active")
    .single();

  // The DB trigger raises a plain exception (not a typed constraint code)
  // when activating a 3rd question — surface it as a clean, expected error
  // rather than a raw Postgres message.
  if (error) {
    if (error.message.includes("at most 2 active")) {
      return { error: `You can have at most ${MAX_ACTIVE_QUESTIONS} active questions. Deactivate one first.` };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/profile");
  return { data: toContextQuestion(data) };
}

export async function deleteContextQuestion(id: unknown): Promise<{ ok: true } | { error: string }> {
  if (typeof id !== "string" || !id) return { error: "Invalid question." };

  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };

  const { error } = await supabase
    .from("business_context_questions")
    .delete()
    .eq("id", id)
    .eq("business_id", owned.businessId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/** Swaps the sort_order of two questions — the only "reorder" a 2-question list needs. */
export async function swapQuestionOrder(
  idA: unknown,
  idB: unknown
): Promise<{ ok: true } | { error: string }> {
  if (typeof idA !== "string" || typeof idB !== "string") return { error: "Invalid questions." };

  const supabase = await createClient();
  const owned = await getOwnedBusiness(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data: rows, error: fetchError } = await supabase
    .from("business_context_questions")
    .select("id, sort_order")
    .eq("business_id", owned.businessId)
    .in("id", [idA, idB]);

  if (fetchError) return { error: fetchError.message };
  if (!rows || rows.length !== 2) return { error: "Could not find both questions." };

  const [a, b] = rows;

  const updateA = await supabase
    .from("business_context_questions")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id)
    .eq("business_id", owned.businessId);
  if (updateA.error) return { error: updateA.error.message };

  const updateB = await supabase
    .from("business_context_questions")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id)
    .eq("business_id", owned.businessId);
  if (updateB.error) return { error: updateB.error.message };

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
