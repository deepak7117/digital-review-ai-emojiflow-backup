"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { setActiveBusiness } from "@/lib/business/actions";
import type { BusinessSummary } from "@/lib/business/activeBusiness";
import { AddBusinessModal } from "@/components/dashboard/AddBusinessModal";
import type { ContactDestination } from "@/lib/config/contact";
import { UpgradeContactState } from "@/components/dashboard/UpgradeContactState";

export function BusinessSwitcher({
  activeBusinessId,
  businesses,
  multistoreEnabled,
  maxBusinesses,
  subscriptionBlocked,
  contact,
}: {
  activeBusinessId: string | null;
  businesses: BusinessSummary[];
  multistoreEnabled: boolean;
  maxBusinesses: number;
  subscriptionBlocked: boolean;
  contact: ContactDestination;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Same pattern as Header.tsx's own menu — this component also lives in
  // the persistent layout, so it needs the same close-on-navigate fix.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

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

  const active = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0];
  const atLimit = businesses.length >= maxBusinesses;
  // Whether there is ANY reason to offer "+ Add Business" at all — true
  // even for an owner who currently has just one business, as long as
  // their entitlement allows a second. Previously this case had no UI
  // path to Add Business at all (the component returned a plain,
  // non-interactive pill whenever businesses.length <= 1), which was a
  // real gap: a newly-entitled single-business owner could never
  // discover or use the feature. Fixed by making the dropdown open
  // whenever there's more than one business OR room to add one.
  const canOfferAdd = multistoreEnabled && !subscriptionBlocked;
  const showDropdown = businesses.length > 1 || canOfferAdd;

  function selectBusiness(id: string) {
    if (id === activeBusinessId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await setActiveBusiness(id);
      setOpen(false);
      if (!("error" in result)) {
        router.refresh();
      }
    });
  }

  // Truly nothing to switch to and nothing to add: the same subtle,
  // non-interactive pill as before — no dropdown affordance at all.
  if (!showDropdown) {
    return active ? (
      <span className="hidden rounded-full bg-ink/[0.04] px-3 py-1 text-xs font-medium text-ink-soft sm:inline">
        {active.businessName}
      </span>
    ) : null;
  }

  return (
    <>
      <div className="relative hidden sm:block" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-full bg-ink/[0.04] px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-ink/[0.07] disabled:opacity-60"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {active?.businessName ?? "Select business"}
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-0 mt-2 w-60 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised py-1.5 shadow-lg"
          >
            <div className="flex items-center justify-between px-3.5 py-1.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Your Businesses</p>
              {canOfferAdd && (
                <p className="font-mono text-[10px] text-slate">
                  {businesses.length} / {maxBusinesses}
                </p>
              )}
            </div>
            {businesses.map((b) => (
              <button
                key={b.id}
                role="menuitem"
                onClick={() => selectBusiness(b.id)}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors hover:bg-ink/5"
              >
                <span className={`w-4 shrink-0 ${b.id === activeBusinessId ? "text-verified" : "text-transparent"}`}>
                  ✓
                </span>
                <span>
                  <span className="block text-ink">{b.businessName}</span>
                  {b.city && <span className="block text-xs text-slate">{b.city}</span>}
                </span>
              </button>
            ))}
            <div className="mt-1 border-t border-border p-1.5">
              {!canOfferAdd || atLimit ? (
                <UpgradeContactState
                  reason={subscriptionBlocked ? "subscription_blocked" : atLimit ? "limit_reached" : "disabled"}
                  contact={contact}
                />
              ) : (
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setAddOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm font-medium text-verified-dark transition-colors hover:bg-verified-tint"
                >
                  + Add Business
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {addOpen && <AddBusinessModal onClose={() => setAddOpen(false)} contact={contact} />}
    </>
  );
}
