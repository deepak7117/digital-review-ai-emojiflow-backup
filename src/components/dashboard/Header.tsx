"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export function DashboardHeader({
  businessName,
  email,
  unreadNotificationCount = 0,
}: {
  businessName: string | null;
  email: string;
  /** Owner-facing count of unread negative-feedback alerts. Defaults to 0 so existing call sites that don't pass it keep working unchanged. */
  unreadNotificationCount?: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
          {businessName && (
            <>
              <span className="hidden h-5 w-px bg-border-strong sm:block" aria-hidden="true" />
              <span className="hidden rounded-full bg-ink/[0.04] px-3 py-1 text-xs font-medium text-ink-soft sm:inline">
                {businessName}
              </span>
            </>
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
          <div className="relative">
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
