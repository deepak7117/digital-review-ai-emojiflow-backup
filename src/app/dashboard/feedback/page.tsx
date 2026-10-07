import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { FeedbackList } from "@/components/dashboard/FeedbackList";
import { markNotificationsRead } from "@/app/dashboard/notifications/actions";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

const PAGE_SIZE = 50;
// Caps how many rows we scan to build the rating-distribution strip. Fine
// at Module 3 scale; a business with heavy volume should get a proper
// aggregated count (Module 5 — Analytics), not a capped client-side scan.
const DISTRIBUTION_SCAN_LIMIT = 500;

export default async function FeedbackInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string }>;
}) {
  const { rating: ratingParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Visiting the inbox is the natural "I've seen this" moment — marks
  // every unread owner_notifications row for this business as read.
  // Non-blocking by construction (fire-and-forget would be ideal, but
  // awaiting here is cheap and keeps the function's own internal error
  // handling simple; it never throws, so it can't fail this page load).
  await markNotificationsRead();

  const { business } = await getActiveBusiness(supabase);

  if (!business) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Feedback</h1>
        <div className="mt-4">
          <Alert tone="info">
            Set up your{" "}
            <Link href="/dashboard/profile" className="font-medium text-verified hover:underline">
              business profile
            </Link>{" "}
            first — feedback is tied to it.
          </Alert>
        </div>
      </div>
    );
  }

  const selectedRating = ["1", "2", "3", "4", "5"].includes(ratingParam ?? "")
    ? Number(ratingParam)
    : null;

  const [distributionResult, submissionsQuery] = await Promise.all([
    supabase
      .from("feedback_submissions")
      .select("rating")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(DISTRIBUTION_SCAN_LIMIT),
    (() => {
      let q = supabase
        .from("feedback_submissions")
        .select("id, rating, tags, message, ai_draft, final_draft, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (selectedRating) q = q.eq("rating", selectedRating);
      return q;
    })(),
  ]);

  const distribution = [1, 2, 3, 4, 5].map((n) => ({
    rating: n,
    count: (distributionResult.data ?? []).filter((r) => r.rating === n).length,
  }));
  const totalScanned = distributionResult.data?.length ?? 0;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Feedback</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every submission your customers have sent, in their own words. This is
        private to you — nothing here is ever posted publicly.
      </p>

      {submissionsQuery.error && (
        <div className="mt-4">
          <Alert tone="error">Couldn&rsquo;t load feedback right now. Please try again.</Alert>
        </div>
      )}

      <FeedbackList
        submissions={submissionsQuery.data ?? []}
        distribution={distribution}
        totalScanned={totalScanned}
        selectedRating={selectedRating}
        distributionCapped={totalScanned >= DISTRIBUTION_SCAN_LIMIT}
      />
    </div>
  );
}
