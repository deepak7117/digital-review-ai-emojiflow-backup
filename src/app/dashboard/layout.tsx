import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BanaoAttribution } from "@/components/ui/BanaoAttribution";
import { getUnreadNotificationCount } from "@/app/dashboard/notifications/actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  // Defense in depth: middleware already redirects unauthenticated requests
  // away from /dashboard, but every server entry point should verify the
  // session independently rather than trusting the client.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("owner_id", user.id)
    .maybeSingle();

  const unreadNotificationCount = await getUnreadNotificationCount();

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader
        businessName={business?.business_name ?? null}
        email={user.email ?? ""}
        unreadNotificationCount={unreadNotificationCount}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 py-8 md:pl-8">{children}</main>
      </div>
      <footer className="border-t border-border px-6 py-5">
        <div className="mx-auto flex w-full max-w-6xl justify-center md:justify-start">
          <BanaoAttribution />
        </div>
      </footer>
    </div>
  );
}
