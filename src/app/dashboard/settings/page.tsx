import Link from "next/link";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/settings/google"
        className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-verified/40 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white shadow-sm"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="none" strokeWidth={1.5} className="h-5 w-5">
              <path
                d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5-3.6-3.5 5-.7z"
                stroke="currentColor"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold text-ink">Google Business Profile</p>
            <p className="mt-0.5 text-xs text-slate">
              Connect your profile to sync reviews and reply directly from BD Clarity.
            </p>
          </div>
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          strokeWidth={1.5}
          className="h-4 w-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5 group-hover:text-verified"
        >
          <path d="M7.5 4l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <ComingSoon
        title="Settings"
        description="Manage your account, team, and billing. Billing arrives with Module 6."
      />
    </div>
  );
}
