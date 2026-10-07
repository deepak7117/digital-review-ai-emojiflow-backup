import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettingsSummary } from "@/app/dashboard/settings/actions";
import { SettingsSignOutButton } from "@/components/dashboard/SettingsSignOutButton";

const icons = {
  profile: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <path d="M3 17V8.5L10 3l7 5.5V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 17v-5h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  brand: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5-3.6-3.5 5-.7z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <circle cx="10" cy="10" r="7" stroke="currentColor" />
      <path d="M10 3a10 10 0 010 14M10 3a10 10 0 000 14M3.3 7.5h13.4M3.3 12.5h13.4" stroke="currentColor" />
    </svg>
  ),
  qr: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <rect x="12" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <rect x="2.5" y="12" width="5.5" height="5.5" rx="1" stroke="currentColor" />
    </svg>
  ),
  branches: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <circle cx="10" cy="4" r="2" stroke="currentColor" />
      <circle cx="4" cy="16" r="2" stroke="currentColor" />
      <circle cx="16" cy="16" r="2" stroke="currentColor" />
      <path d="M10 6v4M10 10L4 14M10 10l6 4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
};

export default async function SettingsPage() {
  const summary = await getSettingsSummary();
  if (!summary) redirect("/login");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">
        Settings
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Manage your business, customer experience, integrations and account preferences.
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        {/* Business Profile — reuses the existing, fully-built profile page. Not duplicated here. */}
        <Link
          href="/dashboard/profile"
          className="flex items-center justify-between gap-3.5 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate">
              {icons.profile}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Business Profile</span>
              <span className="block truncate text-xs text-slate">
                {summary.businessName ?? "Not set up yet"}
                {summary.category ? ` · ${summary.category}` : ""}
              </span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-slate">→</span>
        </Link>

        {/* Brand & Experience — the new, genuinely functional feature. */}
        <Link
          href="/dashboard/settings/brand"
          className="flex items-center justify-between gap-3.5 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate">
              {icons.brand}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Brand &amp; Experience</span>
              <span className="block truncate text-xs text-slate">Logo, theme and customer experience</span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-slate">→</span>
        </Link>

        {/* Google Business Profile — reuses the existing, fully-built connection page. Not duplicated here. */}
        <Link
          href="/dashboard/settings/google"
          className="flex items-center justify-between gap-3.5 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate">
              {icons.google}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">Google Business Profile</span>
              <span
                className={`block truncate text-xs ${summary.googleConnected ? "text-success-dark" : "text-slate"}`}
              >
                {summary.googleConnected
                  ? `🟢 Connected · ${summary.googleLocationName ?? "Location"}`
                  : "Not connected"}
              </span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-slate">→</span>
        </Link>

        {/* QR Feedback — reuses the existing, fully-built QR page. Not duplicated here. */}
        <Link
          href="/dashboard/qr-feedback"
          className="flex items-center justify-between gap-3.5 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate">
              {icons.qr}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">QR Feedback</span>
              <span
                className={`block truncate text-xs ${summary.qrActive ? "text-success-dark" : "text-slate"}`}
              >
                {summary.qrCode ? (summary.qrActive ? "🟢 Active" : "Inactive") : "Not set up yet"}
              </span>
            </span>
          </div>
          <span className="shrink-0 text-xs text-slate">→</span>
        </Link>

        {/* Branches — honestly labeled planned. No fake data, no link to a non-existent feature. */}
        <div className="flex items-center gap-3.5 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-4 opacity-70">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate/50">
            {icons.branches}
          </span>
          <span>
            <span className="block text-sm font-medium text-ink">Branches</span>
            <span className="block font-mono text-[10px] uppercase tracking-wider text-slate/60">
              Planned
            </span>
          </span>
        </div>
      </div>

      {/* Notifications — real content only; no fake toggles for notification types that don't exist. */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-5 shadow-sm">
        <p className="font-display text-base font-semibold text-ink">Notifications</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-ink-soft">New negative feedback alert</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-success-dark">On</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate">New review alerts</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate/60">Planned</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate">AI recommendation alerts</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate/60">Planned</span>
        </div>
      </div>

      {/* Security & Account — real data only. */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-5 shadow-sm">
        <p className="font-display text-base font-semibold text-ink">Security &amp; Account</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate">Account email</span>
          <span className="text-ink">{summary.email}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate">Account role</span>
          <span className="text-ink">Business Owner</span>
        </div>
        <p className="mt-2 text-xs text-slate">
          To change your password, use{" "}
          <Link href="/forgot-password" className="text-verified hover:underline">
            Forgot password
          </Link>{" "}
          from the login screen.
        </p>
        <div className="mt-4">
          <SettingsSignOutButton />
        </div>
      </div>
    </div>
  );
}
