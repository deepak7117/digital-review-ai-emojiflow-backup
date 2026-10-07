"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { grantAdminRole, revokeAdminRole } from "@/app/admin/teamActions";
import type { AdminRole } from "@/types/database";

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin (full access)" },
  { value: "operations_admin", label: "Operations Admin" },
  { value: "support_admin", label: "Support Admin" },
  { value: "read_only_analyst", label: "Read-only Analyst" },
];

interface Member {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
  grantedAt: string;
}

export function AdminTeamPanel({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("operations_admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { error: string }>, okMessage: string) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSuccess(okMessage);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="rounded-lg border border-border-strong bg-paper-raised p-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Add or change an admin</p>
        <p className="mt-1 text-xs text-slate">
          The person must already have an account. Entering an existing admin&apos;s email changes their role.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            className="w-full rounded-md border border-border-strong bg-paper px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="rounded-md border border-border-strong bg-paper px-3 py-2 text-sm text-ink"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            loading={busy}
            onClick={() => run(() => grantAdminRole(email, role), "Admin role saved.")}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-strong">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-raised">
            <tr>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate">Admin</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{m.email ?? m.userId}</p>
                  {m.fullName && <p className="text-xs text-slate">{m.fullName}</p>}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {ROLE_OPTIONS.find((o) => o.value === m.role)?.label ?? m.role}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.userId === currentUserId ? (
                    <span className="text-xs text-slate">You</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Remove admin access for ${m.email ?? "this user"}?`)) {
                          void run(() => revokeAdminRole(m.userId), "Admin access removed.");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
