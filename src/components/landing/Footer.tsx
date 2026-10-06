import { Logo } from "@/components/ui/Logo";
import { branding } from "@/lib/config/branding";

export function Footer() {
  return (
    <footer className="bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Logo dark />
        <p className="text-xs text-paper-raised/60">
          © {branding.copyrightYear} {branding.parentBrand}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
