"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Field";
import { createBranch, setBranchStatus, type Branch } from "@/app/dashboard/branches/actions";
import { UpgradeContactState } from "@/components/dashboard/UpgradeContactState";
import type { ContactDestination } from "@/lib/config/contact";

export function BranchManager({
  initialBranches,
  multiBranchEnabled,
  maxBranches,
  currentActiveCount,
  contact,
}: {
  initialBranches: Branch[];
  multiBranchEnabled: boolean;
  maxBranches: number;
  currentActiveCount: number;
  contact: ContactDestination;
}) {
  const router = useRouter();
  const [branches, setBranches] = useState(initialBranches);
  const [showAdd, setShowAdd] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [address, setAddress] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<"disabled" | "limit_reached" | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const atLimit = currentActiveCount >= maxBranches;
  const canAdd = multiBranchEnabled && !atLimit;

  function handleAddClick() {
    setError(null);
    if (!multiBranchEnabled) {
      setBlockReason("disabled");
      setShowAdd(true);
      return;
    }
    if (atLimit) {
      setBlockReason("limit_reached");
      setShowAdd(true);
      return;
    }
    setBlockReason(null);
    setShowAdd(true);
  }

  function handleCreate() {
    if (!branchName.trim()) {
      setError("Branch name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createBranch(branchName, address);
      if ("error" in result) {
        if (result.reason) {
          setBlockReason(result.reason);
        } else {
          setError(result.error);
        }
        return;
      }
      setShowAdd(false);
      setBranchName("");
      setAddress("");
      router.refresh();
    });
  }

  function handleToggle(branch: Branch) {
    setTogglingId(branch.id);
    const nextStatus = branch.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const result = await setBranchStatus(branch.id, nextStatus);
      setTogglingId(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, status: nextStatus } : b)));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}

      {branches.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-center text-sm text-slate">
          No branches yet. Add your first branch to organize this business.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs"
            >
              <div>
                <p className="text-sm font-medium text-ink">{b.branchName}</p>
                {b.address && <p className="text-xs text-slate">{b.address}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    b.status === "active" ? "bg-success-tint text-success-dark" : "bg-ink/5 text-slate"
                  }`}
                >
                  {b.status}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggle(b)}
                  loading={isPending && togglingId === b.id}
                >
                  {b.status === "active" ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showAdd && (
        <Button size="sm" onClick={handleAddClick} className="w-fit">
          + Add Branch
        </Button>
      )}

      {showAdd && blockReason && (
        <UpgradeContactState reason={blockReason} contact={contact} />
      )}

      {showAdd && !blockReason && (
        <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs">
          <div className="flex flex-col gap-3">
            <Field label="Branch Name" htmlFor="branch-name" required>
              <Input id="branch-name" value={branchName} onChange={(e) => setBranchName(e.target.value)} maxLength={200} />
            </Field>
            <Field label="Address (optional)" htmlFor="branch-address">
              <Input id="branch-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleCreate} loading={isPending}>
              Create Branch
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAdd(false);
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {multiBranchEnabled && !canAdd && !showAdd && (
        <p className="text-xs text-slate">
          {currentActiveCount} of {maxBranches} branches used across your businesses.
        </p>
      )}
    </div>
  );
}
