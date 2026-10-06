import { branding } from "@/lib/config/branding";

/**
 * Subtle, consistent product-attribution treatment — deliberately small
 * and text-only (no logo mark repeated everywhere), per the brand
 * requirement: "premium SaaS product attribution — subtle, consistent
 * and professional," not a large logo on every screen.
 */
export function BanaoAttribution({
  variant = "footer",
  className = "",
}: {
  /** "footer": muted single line for page/app footers. "card": slightly more prominent, for login/onboarding moments. */
  variant?: "footer" | "card";
  className?: string;
}) {
  if (variant === "card") {
    return (
      <p className={`text-center text-xs text-slate ${className}`}>
        A <span className="font-medium text-ink-soft">{branding.parentBrand}</span> Product
      </p>
    );
  }

  return (
    <p className={`text-[11px] text-slate/70 ${className}`}>
      {branding.productShortName} — Powered by {branding.parentBrand}
    </p>
  );
}
