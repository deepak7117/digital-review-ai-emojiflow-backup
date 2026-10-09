"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Field";
import {
  createAdmin,
  changeAdminRole,
  revokeAdmin,
  restoreAdmin,
  type AdminListItem,
} from "@/app/admin/admins/actions";
import { ADMIN_ROLE_LABELS } from "@/lib/admin/roleLabels";
import type { AdminRole } from "@/types/database";

const ROLES: AdminRole[] = ["super_admin", "support_admin", "operations_admin", "read_only_analyst"];

const ROLE_TONE: Record<AdminRole, string> = {
  super_admin: "bg-verified-tint text-verified-dark",
  support_admin: "bg-voice-tint text-voice-dark",
  operations_admin: "bg-gold-tint text-gold",
  read_only_analyst: "bg-ink/5 text-slate",
};

export function AdminManagementTable({
  initialAdmins,
  currentUserId,
}: {
  initialAdmins: AdminListItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    { type: "revoke" | "restore" | "roleChange"; admin: AdminListItem; newRole?: AdminRole } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const filtered = initialAdmins.filter((a) => {
    if (roleFilter !== "all" && a.role !== roleFilter) return false;
    if (statusFilter === "active" && a.revokedAt) return false;
    if (statusFilter === "revoked" && !a.revokedAt) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.email?.toLowerCase().includes(q) && !a.fullName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setBusy(true);
    setError(null);
    let result: { ok: true } | { error: string };

    if (confirmAction.type === "revoke") {
      result = await revokeAdmin(confirmAction.admin.userId);
    } else if (confirmAction.type === "restore") {
      result = await restoreAdmin(confirmAction.admin.userId, confirmAction.admin.role);
    } else {
      result = await changeAdminRole(confirmAction.admin.userId, confirmAction.newRole);
    }

    setBusy(false);
    setConfirmAction(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    showToast(
      confirmAction.type === "revoke"
        ? "Admin access revoked."
        : confirmAction.type === "restore"
          ? "Admin access restored."
          : "Role updated."
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      {toast && <Alert tone="success">{toast}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-3 py-1.5 text-sm text-ink shadow-xs focus:outline-none focus:ring-2 focus:ring-verified/20"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as AdminRole | "all")}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ADMIN_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "revoked")}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Create Admin
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-8 text-center text-sm text-slate">
          No administrators match these filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-border-strong sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-ink/[0.02] text-left font-mono text-[10px] uppercase tracking-wider text-slate">
                  <th className="px-4 py-2.5">Admin</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Granted</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/admins/${a.userId}`} className="font-medium text-ink hover:text-verified">
                        {a.fullName ?? a.email ?? "—"}
                      </Link>
                      {a.fullName && <p className="text-xs text-slate">{a.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_TONE[a.role]}`}>
                        {ADMIN_ROLE_LABELS[a.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.revokedAt ? (
                        <span className="text-xs font-medium text-danger">Revoked</span>
                      ) : (
                        <span className="text-xs font-medium text-success-dark">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate">
                      {new Date(a.grantedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {a.userId === currentUserId ? (
                          <span className="text-xs text-slate">This is you</span>
                        ) : a.revokedAt ? (
                          <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: "restore", admin: a })}>
                            Restore
                          </Button>
                        ) : (
                          <>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const newRole = e.target.value as AdminRole;
                                if (newRole && newRole !== a.role) {
                                  setConfirmAction({ type: "roleChange", admin: a, newRole });
                                }
                                e.target.value = "";
                              }}
                              className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2 py-1 text-xs"
                            >
                              <option value="">Change role…</option>
                              {ROLES.filter((r) => r !== a.role).map((r) => (
                                <option key={r} value={r}>
                                  {ADMIN_ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmAction({ type: "revoke", admin: a })}
                            >
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {filtered.map((a) => (
              <div key={a.userId} className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/admin/admins/${a.userId}`} className="font-medium text-ink">
                    {a.fullName ?? a.email}
                  </Link>
                  {a.revokedAt ? (
                    <span className="text-xs font-medium text-danger">Revoked</span>
                  ) : (
                    <span className="text-xs font-medium text-success-dark">Active</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate">{a.email}</p>
                <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_TONE[a.role]}`}>
                  {ADMIN_ROLE_LABELS[a.role]}
                </span>
                {a.userId !== currentUserId && (
                  <div className="mt-3 flex gap-2">
                    {a.revokedAt ? (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: "restore", admin: a })}>
                        Restore
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: "revoke", admin: a })}>
                        Revoke
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showCreate && (
        <CreateAdminDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            showToast("Invite sent.");
            router.refresh();
          }}
        />
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4" onClick={() => !busy && setConfirmAction(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-6 shadow-lg"
          >
            <p className="font-display text-base font-semibold text-ink">
              {confirmAction.type === "revoke" && "Are you sure you want to revoke this administrator's access?"}
              {confirmAction.type === "restore" && "Restore this administrator's access?"}
              {confirmAction.type === "roleChange" && "Change this administrator's role?"}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {confirmAction.type === "revoke" &&
                `${confirmAction.admin.email}'s access will be removed immediately.`}
              {confirmAction.type === "restore" && `${confirmAction.admin.email} will regain admin access.`}
              {confirmAction.type === "roleChange" &&
                `${ADMIN_ROLE_LABELS[confirmAction.admin.role]} → ${ADMIN_ROLE_LABELS[confirmAction.newRole!]}. Permissions will change immediately.`}
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                size="sm"
                variant={confirmAction.type === "revoke" ? "danger" : "primary"}
                onClick={handleConfirmedAction}
                loading={busy}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmAction(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateAdminDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("read_only_analyst");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const result = await createAdmin(email, role);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border-strong bg-paper-raised p-6 shadow-lg"
      >
        <p className="font-display text-lg font-semibold text-ink">Create Admin</p>
        <p className="mt-1 text-xs text-slate">
          They&rsquo;ll receive a secure invite email to set their own password.
        </p>

        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3.5">
          <Field label="Email" htmlFor="new-admin-email" required>
            <Input id="new-admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Role" htmlFor="new-admin-role">
            <select
              id="new-admin-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-paper-raised px-3.5 py-2.5 text-sm text-ink shadow-xs"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ADMIN_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex gap-2">
          <Button size="sm" onClick={handleCreate} loading={saving}>
            Send Invite
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
