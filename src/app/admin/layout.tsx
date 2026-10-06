import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";
import { BanaoAttribution } from "@/components/ui/BanaoAttribution";
import { getCurrentAdmin, ADMIN_ROLE_LABELS } from "@/lib/admin/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin");
  }

  // Role-based access is enforced here, server-side, against the profiles
  // table — never inferred from client state or by simply hiding a nav
  // link. profiles RLS only lets a user read their own row, so this query
  // is scoped to the signed-in user by definition. This coarse gate is
  // unchanged from Module 1 — every existing "_select_admin" RLS policy
  // still depends on it exactly as before.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fine-grained tier (Super Admin Panel Milestone 1) — a SECOND, additive
  // check on top of the one above. An admin with no active tier assignment
  // (e.g. the coarse flag was set but no one has granted them a role yet)
  // sees a clear explanation instead of being silently let into pages
  // whose permissions would otherwise be undefined for them.
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
        <p className="font-display text-lg font-semibold text-ink">
          No admin role assigned yet
        </p>
        <p className="mt-2 max-w-sm text-sm text-slate">
          Your account has platform admin access, but no admin role tier has
          been assigned to it. Contact a Super Admin to have one granted.
        </p>
        <Link href="/dashboard" className="mt-6 text-sm text-verified hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-ink">
        <div className="flex items-center justify-between px-6 py-4">
          <Logo href="/admin" compact dark />
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-paper-raised/60">
              {ADMIN_ROLE_LABELS[currentAdmin.role]}
            </span>
            <Link href="/dashboard" className="text-sm text-paper-raised/80 hover:text-paper-raised">
              Back to dashboard
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-6 py-8">{children}</main>
      <footer className="border-t border-border px-6 py-5">
        <div className="mx-auto w-full max-w-6xl">
          <BanaoAttribution />
        </div>
      </footer>
    </div>
  );
}
