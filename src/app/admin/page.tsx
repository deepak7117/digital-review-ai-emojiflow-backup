import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, ADMIN_ROLE_LABELS } from "@/lib/admin/permissions";
import { getPlatformSettings } from "@/app/admin/platformSettingsActions";
import { MultiStoreSettingsPanel } from "@/components/admin/MultiStoreSettingsPanel";
import { getPlatformMetrics } from "@/app/admin/platformIntelligenceActions";
import { OwnerSearchPanel } from "@/components/admin/OwnerSearchPanel";

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
    platformSettings,
    platformMetricsResult,
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
    getPlatformSettings(),
    getPlatformMetrics(),
  ]);

  const platformMetrics = "data" in platformMetricsResult ? platformMetricsResult.data : null;

  const statusBreakdown = { active: 0, inactive: 0, suspended: 0 };
  for (const row of statusCounts.data ?? []) {
    statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1;
  }

  /**
   * Semantic KPI coloring, per the approved visual identity:
   * ACTIVE -> Emerald, SUSPENDED -> Red, NEW -> Indigo, QR/feedback
   * activity -> Teal. "Total" and "Inactive" carry no status meaning of
   * their own, so they stay neutral rather than being colored just to
   * fill the grid.
   */
  const statTone: Record<string, string> = {
    text_slate: "text-ink",
    text_success: "text-success-dark",
    text_danger: "text-danger",
    text_verified: "text-verified-dark",
    text_voice: "text-voice-dark",
  };
  const stats = [
    { label: "Total businesses", value: totalBusinesses.count ?? 0, tone: "text_slate" },
    { label: "Active", value: statusBreakdown.active, tone: "text_success" },
    { label: "Inactive", value: statusBreakdown.inactive, tone: "text_slate" },
    { label: "Suspended", value: statusBreakdown.suspended, tone: "text_danger" },
    { label: "New (7 days)", value: newLast7d.count ?? 0, tone: "text_verified" },
    { label: "New (30 days)", value: newLast30d.count ?? 0, tone: "text_verified" },
    { label: "QR mappings", value: totalQrLinks.count ?? 0, tone: "text_voice" },
    { label: "Feedback submissions", value: totalFeedback.count ?? 0, tone: "text_voice" },
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
            <p className={`mt-2 font-display text-2xl font-semibold ${statTone[item.tone]}`}>{item.value}</p>
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
                    log.result === "success" ? "text-success-dark" : "text-danger"
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

      {platformSettings && (
        <MultiStoreSettingsPanel
          initialEnabled={platformSettings.multistoreEnabled}
          initialMax={platformSettings.maxBusinessesPerOwner}
          canEdit={admin?.role === "super_admin"}
        />
      )}

      {/* Milestone B — Platform Intelligence. Every number below comes
          directly from getPlatformMetrics() (businesses, business_branches,
          owner_entitlements) — no placeholder, no demo data. */}
      {platformMetrics && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Platform Intelligence</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4">
              <p className="text-2xl font-semibold text-ink">{platformMetrics.totalOwners}</p>
              <p className="text-xs text-slate">Total Owners</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4">
              <p className="text-2xl font-semibold text-ink">
                {platformMetrics.activeBusinesses}
                <span className="text-sm text-slate"> / {platformMetrics.totalBusinesses}</span>
              </p>
              <p className="text-xs text-slate">Active Businesses</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4">
              <p className="text-2xl font-semibold text-ink">
                {platformMetrics.activeBranches}
                <span className="text-sm text-slate"> / {platformMetrics.totalBranches}</span>
              </p>
              <p className="text-xs text-slate">Active Branches</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4">
              <p className="text-2xl font-semibold text-ink">
                {platformMetrics.multiBusinessOwners} / {platformMetrics.multiBranchOwners}
              </p>
              <p className="text-xs text-slate">Multi-Business / Multi-Branch Owners</p>
            </div>
          </div>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-slate">Entitlement Intelligence</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Active", value: platformMetrics.entitlement.active, tone: "text-success-dark" },
              { label: "Expired", value: platformMetrics.entitlement.expired, tone: "text-danger" },
              { label: "Suspended", value: platformMetrics.entitlement.suspended, tone: "text-gold" },
              { label: "Disabled", value: platformMetrics.entitlement.disabled, tone: "text-slate" },
              {
                label: "Expiring (7d)",
                value: platformMetrics.entitlement.expiringWithin7Days,
                tone: "text-danger",
              },
              {
                label: "Expiring (30d)",
                value: platformMetrics.entitlement.expiringWithin30Days,
                tone: "text-gold",
              },
            ].map((m) => (
              <div key={m.label} className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-3">
                <p className={`text-xl font-semibold ${m.tone}`}>{m.value}</p>
                <p className="text-[11px] text-slate">{m.label}</p>
              </div>
            ))}
          </div>
          {platformMetrics.entitlement.notConfigured > 0 && (
            <p className="mt-2 text-xs text-slate">
              {platformMetrics.entitlement.notConfigured} owner(s) have no individual entitlement configured —
              using the platform default above.
            </p>
          )}
        </div>
      )}

      <OwnerSearchPanel />

      <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-sm text-slate">
        QR mapping tools and AI usage monitoring ship in a future milestone.{" "}
        <Link href="/dashboard" className="text-verified hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
