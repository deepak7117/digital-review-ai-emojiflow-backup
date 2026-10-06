import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin, hasCapability } from "@/lib/admin/permissions";
import {
  getBusinessDetail,
  listSupportNotes,
  getBusinessAuditHistory,
} from "@/app/admin/businesses/actions";
import { BusinessStatusControl } from "@/components/admin/BusinessStatusControl";
import { SupportNotesPanel } from "@/components/admin/SupportNotesPanel";

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getCurrentAdmin();
  if (!admin) notFound();

  const [detailResult, historyResult] = await Promise.all([
    getBusinessDetail(id),
    getBusinessAuditHistory(id),
  ]);

  if ("error" in detailResult) notFound();
  const business = detailResult.data;

  const canManageNotes = hasCapability(admin.role, "manage_support_notes");
  const notesResult = canManageNotes ? await listSupportNotes(id) : null;
  const notes = notesResult && "data" in notesResult ? notesResult.data : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/businesses" className="text-xs text-verified hover:underline">
          ← All businesses
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
          {business.businessName}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {business.ownerEmail ?? "No owner email on file"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
            Business details
          </p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Category</dt>
              <dd className="text-ink">{business.category ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">City</dt>
              <dd className="text-ink">{business.city ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Phone</dt>
              <dd className="text-ink">{business.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Website</dt>
              <dd className="truncate text-ink">{business.website ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Segment</dt>
              <dd className="text-ink">
                {business.industrySlug && business.segmentSlug
                  ? `${business.industrySlug} / ${business.segmentSlug}`
                  : "Not set"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Created</dt>
              <dd className="text-ink">{new Date(business.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <BusinessStatusControl
          businessId={business.id}
          currentStatus={business.status}
          canManage={hasCapability(admin.role, "manage_business_status")}
        />
      </div>

      <SupportNotesPanel
        businessId={business.id}
        initialNotes={notes}
        canManage={canManageNotes}
        canView={canManageNotes}
      />

      <div>
        <h2 className="font-display text-base font-semibold text-ink">Account history</h2>
        {"error" in historyResult ? (
          <div className="mt-3 rounded-lg border border-danger/25 bg-danger-tint p-4 text-sm text-danger">
            {historyResult.error}
          </div>
        ) : historyResult.data.length === 0 ? (
          <div className="mt-3 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-center text-sm text-slate">
            No recorded admin activity for this business yet.
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {historyResult.data.map((entry, i) => (
              <li key={i} className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{entry.action}</span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider ${
                      entry.result === "success" ? "text-verified" : "text-danger"
                    }`}
                  >
                    {entry.result}
                  </span>
                </div>
                {entry.reason && <p className="mt-1 text-xs text-ink-soft">{entry.reason}</p>}
                <p className="mt-1 text-[10px] text-slate">
                  {entry.adminEmail ?? "Unknown admin"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
