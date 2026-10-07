"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <path d="M4 11.5L12 4l8 7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v8.5a1 1 0 001 1h3.5v-5h3v5H17a1 1 0 001-1V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  voice: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <path d="M4 5.5h16a1 1 0 011 1V16a1 1 0 01-1 1H9l-5 3.6V17H4a1 1 0 01-1-1V6.5a1 1 0 011-1z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M18.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  reviews: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <path d="M12 3.5l2.5 5.3 5.8.8-4.2 4 1 5.7L12 16.5l-5.1 2.8 1-5.7-4.2-4 5.8-.8z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className="h-[22px] w-[22px]">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const items: { href: string; label: string; icon: keyof typeof icons }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/feedback", label: "Voice", icon: "voice" },
  { href: "/dashboard/intelligence", label: "AI", icon: "ai" },
  { href: "/dashboard/reputation", label: "Reviews", icon: "reviews" },
  { href: "/dashboard/more", label: "More", icon: "more" },
];

/**
 * Persistent mobile bottom navigation — purpose-designed, not a shrunk
 * sidebar. Shown only below md; the existing Sidebar remains the desktop
 * navigation, untouched. Pure presentation: every href already exists as
 * a real route, nothing here introduces new pages beyond /dashboard/more.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-paper-raised/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
            >
              <span className={active ? "text-verified" : "text-slate"}>{icons[item.icon]}</span>
              <span
                className={`text-[10px] font-medium transition-colors ${active ? "text-verified-dark" : "text-slate"}`}
              >
                {item.label}
              </span>
              {active && <span className="h-0.5 w-5 rounded-full bg-verified" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
