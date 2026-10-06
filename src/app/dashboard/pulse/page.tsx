import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { PulseManager } from "@/components/dashboard/pulse/PulseManager";
import type { PollWithResults } from "@/app/dashboard/pulse/actions";
import { getSegmentConfig, generateSegmentPulseQuestions } from "@/lib/segments/engine";

const RESPONSE_SCAN_LIMIT = 5000;

export default async function CustomerPulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, industry_slug, segment_slug")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Customer Pulse</h1>
        <div className="mt-4">
          <Alert tone="info">
            Set up your{" "}
            <Link href="/dashboard/profile" className="font-medium text-verified hover:underline">
              business profile
            </Link>{" "}
            first — polls are tied to it.
          </Alert>
        </div>
      </div>
    );
  }

  const { data: polls } = await supabase
    .from("customer_pulse_polls")
    .select("id, public_code, question, options, is_active, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const pollIds = (polls ?? []).map((p) => p.id);

  const responseCounts = new Map<string, number[]>();
  if (pollIds.length > 0) {
    const { data: responses } = await supabase
      .from("customer_pulse_responses")
      .select("poll_id, option_index")
      .in("poll_id", pollIds)
      .limit(RESPONSE_SCAN_LIMIT);

    for (const poll of polls ?? []) {
      responseCounts.set(poll.id, new Array(poll.options.length).fill(0));
    }
    for (const r of responses ?? []) {
      const counts = responseCounts.get(r.poll_id);
      if (counts && r.option_index >= 0 && r.option_index < counts.length) {
        counts[r.option_index] += 1;
      }
    }
  }

  const pollsWithResults: PollWithResults[] = (polls ?? []).map((p) => {
    const optionCounts = responseCounts.get(p.id) ?? new Array(p.options.length).fill(0);
    return {
      id: p.id,
      publicCode: p.public_code,
      question: p.question,
      options: p.options,
      isActive: p.is_active,
      createdAt: p.created_at,
      totalResponses: optionCounts.reduce((sum, c) => sum + c, 0),
      optionCounts,
    };
  });

  const segmentConfig =
    business.industry_slug && business.segment_slug
      ? getSegmentConfig(business.industry_slug, business.segment_slug)
      : null;
  const suggestedQuestions = segmentConfig ? generateSegmentPulseQuestions(segmentConfig) : [];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Customer Pulse</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Ask a quick one-question poll and get a real answer, fast.
      </p>

      <div className="mt-6">
        <PulseManager
          initialPolls={pollsWithResults}
          suggestedQuestions={suggestedQuestions}
          segmentName={segmentConfig?.displayName ?? null}
        />
      </div>
    </div>
  );
}
