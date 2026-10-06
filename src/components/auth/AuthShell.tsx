import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { BanaoAttribution } from "@/components/ui/BanaoAttribution";
import { branding } from "@/lib/config/branding";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  showTagline = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Shows the product tagline beneath the logo — used on the login screen specifically, not every auth screen. */
  showTagline?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-6 py-12">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden="true"
      />
      <div className="relative mb-9 flex flex-col items-center gap-2.5">
        <Logo />
        {showTagline && (
          <p className="max-w-xs text-center text-sm text-ink-soft">{branding.tagline}</p>
        )}
      </div>
      <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-8 shadow-lg sm:p-9">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gradient-brand)" }} aria-hidden="true" />
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {footer && <div className="relative mt-6 text-sm text-ink-soft">{footer}</div>}
      <div className="relative mt-9">
        <BanaoAttribution variant="card" />
      </div>
    </div>
  );
}
