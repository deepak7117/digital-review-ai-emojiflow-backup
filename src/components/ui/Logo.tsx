import Link from "next/link";
import { branding } from "@/lib/config/branding";

/**
 * BD Clarity wordmark — two-tone treatment matching the official brand
 * reference (charcoal "BD" + Banao Digital orange "Clarity"). Derived from
 * branding.productShortName rather than hardcoded, so it stays in sync if
 * that config value ever changes. Design-only component: no logic here,
 * safe to reuse everywhere the logo already appears.
 */
export function Logo({
  href = "/",
  compact = false,
  dark = false,
  showAttribution = true,
}: {
  href?: string;
  compact?: boolean;
  dark?: boolean;
  /** Shows the small "by Banao Digital" line beneath the wordmark (hidden automatically when compact). */
  showAttribution?: boolean;
}) {
  const smashed = branding.productShortName.replace(/\s+/g, "");
  const firstPart = smashed.slice(0, 2);
  const restPart = smashed.slice(2);

  return (
    <Link href={href} className="inline-flex items-center gap-2.5 group">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display font-semibold text-sm text-white shadow-sm"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden="true"
      >
        {firstPart.charAt(0)}
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display font-semibold text-[15px] tracking-tight">
            <span className={dark ? "text-paper-raised" : "text-ink"}>{firstPart}</span>
            <span className="text-verified">{restPart}</span>
          </span>
          {showAttribution && (
            <span
              className={`text-[10px] uppercase tracking-wider font-mono ${
                dark ? "text-paper-raised/60" : "text-slate"
              }`}
            >
              by {branding.parentBrand}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
