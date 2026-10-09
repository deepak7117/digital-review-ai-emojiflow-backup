import { redirect } from "next/navigation";
import { getCurrentAdmin, hasCapability } from "@/lib/admin/permissions";
import { listAdmins } from "@/app/admin/admins/actions";
import { AdminManagementTable } from "@/components/admin/AdminManagementTable";

export default async function AdminManagementPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/dashboard");
  if (!hasCapability(admin.role, "manage_admin_roles")) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-2xl font-semibold text-ink">Admin Management</h1>
        <p className="mt-3 text-sm text-slate">
          You don&rsquo;t have permission to view platform administrators.
        </p>
      </div>
    );
  }

  const result = await listAdmins();
  const admins = "data" in result ? result.data : [];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Admin Management</h1>
      <p className="mt-1 text-sm text-slate">Manage platform administrators and their roles.</p>

      <div className="mt-6">
        <AdminManagementTable initialAdmins={admins} currentUserId={admin.userId} />
      </div>
    </div>
  );
}
