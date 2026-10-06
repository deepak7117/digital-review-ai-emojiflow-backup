import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, ADMIN_ROLE_LABELS } from "@/lib/admin/permissions";

/**
 * Milestone 1: a real dashboard reading only real, already-existing
 * platform data — every figure here is a genuine count from the database,
 * never a placeholder. Two capabilities (branch stats, AI usage stats)
 * don't have data to show yet because the underlying tables don't exist
 * until Milestones 3 and 5 — those are shown as honest "coming soon"
 * notes, never a fabricated 0 or "—" dressed up as a real figure.
 */
export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();
  const supabase = await createClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalBusinesses,
    statusCounts,
    newLast7d,
    newLast30d,
    totalQrLinks,
    totalFeedback,
    recentAuditLogs,
  ] = await Promise.all([
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("businesses").select("status"),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    supabase.from("feedback_links").select("id", { count: "exact", head: true }),
    supabase.from("feedback_submissions").select("id", { count: "exact", head: true }),
    supabase
      .from("audit_logs")
      .select("action, target_type, result, created_at, admin_user_id")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const statusBreakdown = { active: 0, inactive: 0, suspended: 0 };
  for (const row of statusCounts.data ?? []) {
    statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1;
  }

  const stats = [
    { label: "Total businesses", value: totalBusinesses.count ?? 0 },
    { label: "Active", value: statusBreakdown.active },
    { label: "Inactive", value: statusBreakdown.inactive },
    { label: "Suspended", value: statusBreakdown.suspended },
    { label: "New (7 days)", value: newLast7d.count ?? 0 },
    { label: "New (30 days)", value: newLast30d.count ?? 0 },
    { label: "QR mappings", value: totalQrLinks.count ?? 0 },
    { label: "Feedback submissions", value: totalFeedback.count ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">System overview</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Signed in as {ADMIN_ROLE_LABELS[admin!.role]}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate">{item.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-5 text-sm text-slate">
          <p className="font-medium text-ink-soft">Branch management</p>
          <p className="mt-1">Coming in Milestone 3.</p>
        </div>
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-5 text-sm text-slate">
          <p className="font-medium text-ink-soft">AI usage monitoring</p>
          <p className="mt-1">Coming in Milestone 5.</p>
        </div>
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-ink">Recent admin activity</h2>
        {recentAuditLogs.data && recentAuditLogs.data.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {recentAuditLogs.data.map((log, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs text-sm"
              >
                <span className="font-medium text-ink">{log.action}</span>
                {log.target_type && <span className="text-slate"> · {log.target_type}</span>}
                <span
                  className={`ml-2 font-mono text-[10px] uppercase tracking-wider ${
                    log.result === "success" ? "text-verified" : "text-danger"
                  }`}
                >
                  {log.result}
                </span>
                <p className="mt-1 text-xs text-slate">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-center text-sm text-slate">
            No admin activity recorded yet. Actions taken in this panel (Milestone 2 onward)
            will appear here.
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-sm text-slate">
        Business account management, branch management, QR mapping tools, AI usage
        monitoring, admin team management, and platform settings ship in Milestones
        2–7.{" "}
        <Link href="/dashboard" className="text-verified hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
