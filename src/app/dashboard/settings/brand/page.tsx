import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettingsSummary } from "@/app/dashboard/settings/actions";
import { BrandSettingsForm } from "@/components/dashboard/BrandSettingsForm";

export default async function BrandSettingsPage() {
  const summary = await getSettingsSummary();
  if (!summary) redirect("/login");
  if (!summary.businessName) redirect("/dashboard/profile");

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/settings" className="text-xs text-verified hover:underline">
        ← Settings
      </Link>
      <h1 className="mt-2 font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">
        Brand &amp; Experience
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Control how customers experience your feedback journey.
      </p>

      <div className="mt-6">
        <BrandSettingsForm
          businessName={summary.businessName}
          initialLogoUrl={summary.logoUrl}
          initialThemeId={summary.brandTheme}
        />
      </div>
    </div>
  );
}
