import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin/permissions";
import { getOwnerDetail } from "@/app/admin/platformIntelligenceActions";
import { OwnerEntitlementPanel } from "@/components/admin/OwnerEntitlementPanel";
import { OwnerPasswordResetButton } from "@/components/admin/OwnerPasswordResetButton";

const BUSINESS_STATUS_TONE: Record<string, string> = {
  active: "bg-success-tint text-success-dark",
  inactive: "bg-ink/5 text-slate",
  suspended: "bg-danger-tint text-danger",
};

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getCurrentAdmin();
  if (!admin) notFound();

  const result = await getOwnerDetail(id);
  if ("error" in result) notFound();
  const owner = result.data;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/admin" className="text-sm text-verified hover:underline">
        ← Platform Dashboard
      </Link>

      {/* Overview */}
      <div className="mt-4">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {owner.fullName ?? owner.email ?? "Owner"}
        </h1>
        <p className="mt-1 text-sm text-slate">{owner.email}</p>
        {owner.profileCreatedAt && (
          <p className="mt-1 text-xs text-slate">
            Owner since {new Date(owner.profileCreatedAt).toLocaleDateString()}
          </p>
        )}
        {admin.role === "super_admin" && <OwnerPasswordResetButton ownerEmail={owner.email} />}
      </div>

      {/* Subscription / Entitlement — Batch A: now directly editable
          here, not just a read-only summary linking away to a business
          page. Reuses the exact same OwnerEntitlementPanel/
          upsertOwnerEntitlement() built in Phase 1 — not a second
          entitlement editor. */}
      <div className="mt-6">
        <OwnerEntitlementPanel
          ownerId={owner.ownerId}
          ownerEmail={owner.entitlement?.ownerEmail ?? owner.email}
          currentBusinessCount={owner.entitlement?.currentBusinessCount ?? owner.businesses.length}
          platformMaxBusinesses={owner.entitlement?.platformMaxBusinesses ?? 4}
          initialEntitlement={owner.entitlement?.entitlement ?? null}
          canEdit={admin.role === "super_admin"}
        />
      </div>

      {/* Businesses -> Branches */}
      <div className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Businesses ({owner.businesses.length})
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {owner.businesses.map((b) => (
            <Link
              key={b.id}
              href={`/admin/businesses/${b.id}`}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-3.5 shadow-xs hover:border-verified/30"
            >
              <div>
                <p className="text-sm font-medium text-ink">{b.businessName}</p>
                <p className="text-xs text-slate">
                  {b.branchCount} branch{b.branchCount === 1 ? "" : "es"} · Created{" "}
                  {new Date(b.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${BUSINESS_STATUS_TONE[b.status]}`}
              >
                {b.status}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate">{owner.feedbackSubmissionCount} total feedback submissions across all businesses.</p>
      </div>

      {/* Activity */}
      <div className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Recent Activity</p>
        {owner.recentActivity.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No recorded platform activity for this owner yet.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {owner.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2 text-xs">
                <span className="text-ink">{a.action.replace(/_/g, " ")}</span>
                <span className={a.result === "success" ? "text-success-dark" : "text-danger"}>
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
