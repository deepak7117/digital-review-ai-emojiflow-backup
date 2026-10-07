import { notFound } from "next/navigation";
import { getCurrentAdmin, hasCapability } from "@/lib/admin/permissions";
import { listAdminTeam } from "@/app/admin/teamActions";
import { AdminTeamPanel } from "@/components/admin/AdminTeamPanel";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  if (!admin || !hasCapability(admin.role, "manage_admin_roles")) notFound();

  const result = await listAdminTeam();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Admin team</h1>
        <p className="mt-1 text-sm text-ink-soft">Grant, change, or remove admin access. Super Admin only.</p>
      </div>
      {"error" in result ? (
        <div className="rounded-lg border border-danger/25 bg-danger-tint p-4 text-sm text-danger">{result.error}</div>
      ) : (
        <AdminTeamPanel members={result.data} currentUserId={admin.userId} />
      )}
    </div>
  );
}
