"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Minimal, consistent icon set — hand-crafted inline SVGs (20x20,
 * stroke-based, 1.5px weight) rather than adding a new icon-library
 * dependency, which would be a bigger footprint than this design pass
 * calls for. Same visual language throughout: no fills, rounded joins.
 */
const icons: Record<string, ReactNode> = {
  overview: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" stroke="currentColor" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.5" stroke="currentColor" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <path d="M3 17V8.5L10 3l7 5.5V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 17v-5h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  qr: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <rect x="12" y="2.5" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <rect x="2.5" y="12" width="5.5" height="5.5" rx="1" stroke="currentColor" />
      <path d="M12.5 12.5h2.2M15.5 12.5h2M12.5 15.5h2.2M17.5 15.5v1.8M12.5 17.5h2" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <path d="M3 4.5h14a1 1 0 011 1V13a1 1 0 01-1 1H8l-4 3v-3H3a1 1 0 01-1-1V5.5a1 1 0 011-1z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  intelligence: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <path d="M10 2.5a4.5 4.5 0 00-4.5 4.5c0 1.6.8 2.6 1.5 3.4.5.6.8 1 .8 1.6v1h4.4v-1c0-.6.3-1 .8-1.6.7-.8 1.5-1.8 1.5-3.4A4.5 4.5 0 0010 2.5z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M8 16h4M8.5 17.5h3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  actions: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" />
      <path d="M6.5 10.3l2 2 4-4.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <path d="M2.5 10.5h3l1.5-4 3 7 1.5-4.5h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <path d="M3 17V3M3 17h14" stroke="currentColor" strokeLinecap="round" />
      <rect x="5.5" y="11" width="2.3" height="4" rx="0.5" stroke="currentColor" />
      <rect x="9.3" y="7.5" width="2.3" height="7.5" rx="0.5" stroke="currentColor" />
      <rect x="13.1" y="4.5" width="2.3" height="10.5" rx="0.5" stroke="currentColor" />
    </svg>
  ),
  reputation: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5-3.6-3.5 5-.7z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-[18px] w-[18px]">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.1 5.1l1.4 1.4M13.5 13.5l1.4 1.4M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
};

interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof icons;
  enabled: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Overview", icon: "overview", enabled: true }],
  },
  {
    label: "Customer Experience",
    items: [
      { href: "/dashboard/qr-feedback", label: "QR Feedback", icon: "qr", enabled: true },
      { href: "/dashboard/feedback", label: "Feedback", icon: "feedback", enabled: true },
      { href: "/dashboard/intelligence", label: "Customer Intelligence", icon: "intelligence", enabled: true },
      { href: "/dashboard/actions", label: "Customer Actions", icon: "actions", enabled: true },
      { href: "/dashboard/pulse", label: "Customer Pulse", icon: "pulse", enabled: true },
    ],
  },
  {
    label: "Reputation",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: "analytics", enabled: true },
      { href: "/dashboard/reputation", label: "Google Reputation", icon: "reputation", enabled: true },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/profile", label: "Business Profile", icon: "profile", enabled: true },
      { href: "/dashboard/settings", label: "Settings", icon: "settings", enabled: false },
    ],
  },
];

const flatNavItems = navGroups.flatMap((g) => g.items);

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile navigation — a horizontally-scrolling tab bar, shown only
          below md. Reuses the exact same items as the desktop sidebar;
          purely presentational, no new interactive/toggle state. */}
      <nav
        className="-mx-6 flex gap-1 overflow-x-auto border-b border-border px-6 py-2.5 md:hidden"
        aria-label="Dashboard"
      >
        {flatNavItems
          .filter((item) => item.enabled)
          .map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "bg-verified text-white font-medium shadow-sm" : "text-ink-soft bg-ink/[0.03]"
                }`}
              >
                <span className={active ? "text-white" : "text-slate"}>{icons[item.icon]}</span>
                {item.label}
              </Link>
            );
          })}
      </nav>

      <nav className="hidden w-64 shrink-0 border-r border-border py-8 pr-5 md:block" aria-label="Dashboard">
        <div className="flex flex-col gap-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 font-mono text-[10px] font-medium uppercase tracking-wider text-slate/70">
                {group.label}
              </p>
              <ul className="mt-2 flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  if (!item.enabled) {
                    return (
                      <li key={item.href}>
                        <span className="flex cursor-not-allowed items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-sm text-slate/50">
                          <span className="flex items-center gap-2.5">
                            <span className="text-slate/40">{icons[item.icon]}</span>
                            {item.label}
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-slate/40">
                            Soon
                          </span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] border-l-[3px] py-2 pl-[9px] pr-3 text-sm transition-colors ${
                          active
                            ? "border-verified bg-verified-tint font-medium text-verified-dark"
                            : "border-transparent text-ink-soft hover:bg-ink/[0.04] hover:text-ink"
                        }`}
                      >
                        <span className={active ? "text-verified" : "text-slate"}>{icons[item.icon]}</span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
