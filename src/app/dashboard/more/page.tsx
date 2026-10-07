import Link from "next/link";

const icons = {
  profile: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <path d="M3 17V8.5L10 3l7 5.5V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 17v-5h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  qr: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <rect x="12" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <rect x="2.5" y="12" width="5.5" height="5.5" rx="1" stroke="currentColor" />
    </svg>
  ),
  actions: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" />
      <path d="M6.5 10.3l2 2 4-4.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <path d="M2.5 10.5h3l1.5-4 3 7 1.5-4.5h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <path d="M3 17V3M3 17h14" stroke="currentColor" strokeLinecap="round" />
      <rect x="5.5" y="11" width="2.3" height="4" rx="0.5" stroke="currentColor" />
      <rect x="9.3" y="7.5" width="2.3" height="7.5" rx="0.5" stroke="currentColor" />
      <rect x="13.1" y="4.5" width="2.3" height="10.5" rx="0.5" stroke="currentColor" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
};

const items: { href: string; label: string; description: string; icon: keyof typeof icons; enabled: boolean }[] = [
  { href: "/dashboard/profile", label: "Business Profile", description: "Your details, category and Google link", icon: "profile", enabled: true },
  { href: "/dashboard/qr-feedback", label: "QR Feedback", description: "Your customer feedback QR code", icon: "qr", enabled: true },
  { href: "/dashboard/actions", label: "Customer Actions", description: "Recommended actions, prioritized", icon: "actions", enabled: true },
  { href: "/dashboard/pulse", label: "Customer Pulse", description: "Quick polls for your customers", icon: "pulse", enabled: true },
  { href: "/dashboard/analytics", label: "Analytics", description: "Trends over time", icon: "analytics", enabled: true },
  { href: "/dashboard/settings", label: "Settings", description: "Business, brand, Google, QR and account", icon: "settings", enabled: true },
];

/**
 * Secondary-module screen — exists so the mobile Home can stay compact
 * and intelligence-led, per the requested information architecture.
 * Reuses the exact existing routes/modules; introduces no new feature.
 */
export default function MorePage() {
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">More</h1>
      <p className="mt-1 text-sm text-ink-soft">Everything else, in one place.</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {items.map((item) =>
          item.enabled ? (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3.5 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate">
                {icons[item.icon]}
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{item.label}</span>
                <span className="block text-xs text-slate">{item.description}</span>
              </span>
            </Link>
          ) : (
            <div
              key={item.href}
              className="flex items-center gap-3.5 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-4 opacity-60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-ink/[0.04] text-slate/50">
                {icons[item.icon]}
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{item.label}</span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate/60">
                  Coming soon
                </span>
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
