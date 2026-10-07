"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export function DashboardHeader({
  businessName,
  email,
  unreadNotificationCount = 0,
  switcher,
}: {
  businessName: string | null;
  email: string;
  /** Owner-facing count of unread negative-feedback alerts. Defaults to 0 so existing call sites that don't pass it keep working unchanged. */
  unreadNotificationCount?: number;
  /** The Business Switcher (Multi-Store milestone) — optional so any other caller of this header keeps working unchanged; falls back to the plain business-name pill when omitted. */
  switcher?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [lastPathname, setLastPathname] = useState(pathname);

  // This header lives in the persistent dashboard layout (not remounted
  // when only the page changes), so without this, opening the menu and
  // then navigating via the sidebar/bottom nav would leave it rendered
  // open on top of the new page — a real, confirmed bug, not a
  // hypothetical one. Deliberately NOT a useEffect: React's own guidance
  // for "reset state when a prop/derived value changes" is to compare
  // during render and call the state setter directly, which avoids an
  // extra unconditional render pass after every navigation (and avoids
  // this project's react-hooks/set-state-in-effect lint rule, which
  // correctly flags the naive useEffect(() => setOpen(false), [pathname])
  // version of this same fix as an anti-pattern).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Defense in depth alongside the pathname-close above: also closes on
  // an outside click/tap, so the menu never lingers open if the owner
  // dismisses it without navigating or without using Log out.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (businessName || email).charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-paper-raised/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Logo href="/dashboard" compact />
          {switcher ? (
            <>
              <span className="hidden h-5 w-px bg-border-strong sm:block" aria-hidden="true" />
              {switcher}
            </>
          ) : (
            businessName && (
              <>
                <span className="hidden h-5 w-px bg-border-strong sm:block" aria-hidden="true" />
                <span className="hidden rounded-full bg-ink/[0.04] px-3 py-1 text-xs font-medium text-ink-soft sm:inline">
                  {businessName}
                </span>
              </>
            )
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadNotificationCount > 0 && (
            <Link
              href="/dashboard/feedback"
              className="flex items-center gap-1.5 rounded-full bg-danger-tint px-3 py-1.5 text-xs font-medium text-danger shadow-xs transition-colors hover:bg-danger-tint/70"
              title="New feedback needs your attention"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
              {unreadNotificationCount} new
            </Link>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
              style={{ background: "var(--gradient-brand)" }}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              {initial}
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised py-1 shadow-lg"
              >
                <div className="border-b border-border px-3.5 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{email}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="block w-full px-3.5 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-60"
                >
                  {loggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
