import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { computeFeedbackAnalytics } from "@/lib/analytics/computeFeedbackAnalytics";
import {
  RatingDistributionChart,
  WeeklyTrendChart,
  TagBreakdownList,
} from "@/components/dashboard/AnalyticsCharts";
import { getActiveBusiness } from "@/lib/business/activeBusiness";

// Caps how many rows we scan to compute analytics. Fine at Module 5 scale;
// a high-volume business would eventually want a database-side aggregate
// (materialized view or scheduled rollup) instead of scanning raw rows on
// every page load — flagged as a known limitation, not solved here, to
// keep this module's footprint minimal and avoid a speculative migration
// for a scale this project doesn't have yet.
const ANALYTICS_SCAN_LIMIT = 2000;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { business } = await getActiveBusiness(supabase);

  if (!business) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Analytics</h1>
        <div className="mt-4">
          <Alert tone="info">
            Set up your{" "}
            <Link href="/dashboard/profile" className="font-medium text-verified hover:underline">
              business profile
            </Link>{" "}
            first — analytics are tied to it.
          </Alert>
        </div>
      </div>
    );
  }

  const { data: rows, error } = await supabase
    .from("feedback_submissions")
    .select("rating, tags, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(ANALYTICS_SCAN_LIMIT);

  if (error) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Analytics</h1>
        <div className="mt-4">
          <Alert tone="error">Couldn&rsquo;t load analytics right now. Please try again.</Alert>
        </div>
      </div>
    );
  }

  const analytics = computeFeedbackAnalytics(rows ?? []);
  const scanCapped = (rows?.length ?? 0) >= ANALYTICS_SCAN_LIMIT;

  if (analytics.total === 0) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Analytics</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Trends, tag breakdowns, and rating distribution for {business.business_name}.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-slate">
          No feedback yet — analytics will appear here once customers start
          responding through your{" "}
          <Link href="/dashboard/qr-feedback" className="font-medium text-verified hover:underline">
            QR feedback link
          </Link>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Analytics</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Trends, tag breakdowns, and rating distribution for {business.business_name}.
      </p>

      {scanCapped && (
        <p className="mt-3 text-xs text-slate">
          Showing analytics for your most recent {ANALYTICS_SCAN_LIMIT} submissions.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
            Total feedback
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{analytics.total}</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
            Average rating
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">
            {analytics.avgRating}★
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-6 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Rating distribution
        </p>
        <div className="mt-4">
          <RatingDistributionChart distribution={analytics.distribution} />
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-6 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Weekly trend (last 8 weeks)
        </p>
        <div className="mt-4">
          <WeeklyTrendChart weeklyTrend={analytics.weeklyTrend} />
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-6 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Tag breakdown
        </p>
        <div className="mt-4">
          <TagBreakdownList tagBreakdown={analytics.tagBreakdown} />
        </div>
      </div>
    </div>
  );
}
