import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin, hasCapability, ADMIN_ROLE_LABELS } from "@/lib/admin/permissions";
import { getAdminDetail } from "@/app/admin/admins/actions";

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/dashboard");
  if (!hasCapability(admin.role, "manage_admin_roles")) redirect("/admin/admins");

  const result = await getAdminDetail(id);
  if ("error" in result) notFound();
  const detail = result.data;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/admins" className="text-xs text-verified hover:underline">
        ← Admin Management
      </Link>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
        {detail.fullName ?? detail.email}
      </h1>
      <p className="mt-1 text-sm text-slate">{detail.email}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Identity</p>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate">Status</dt>
              <dd className={detail.revokedAt ? "text-danger" : "text-success-dark"}>
                {detail.revokedAt ? "Revoked" : "Active"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Created</dt>
              <dd className="text-ink">
                {detail.profileCreatedAt ? new Date(detail.profileCreatedAt).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Role</p>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate">Current role</dt>
              <dd className="text-ink">{ADMIN_ROLE_LABELS[detail.role]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Assigned</dt>
              <dd className="text-ink">{new Date(detail.grantedAt).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Assigned by</dt>
              <dd className="text-ink">{detail.grantedByEmail ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Capabilities (from the existing role matrix)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {detail.capabilities.map((c) => (
            <span key={c} className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink-soft">
              {c.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Recent Activity</p>
        {detail.recentActivity.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No recorded activity yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {detail.recentActivity.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink">{a.action.replace(/_/g, " ")}</span>
                <span className={`font-mono text-[10px] uppercase ${a.result === "success" ? "text-success-dark" : "text-danger"}`}>
                  {a.result}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
