"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchOwners, type OwnerSearchPage } from "@/app/admin/platformIntelligenceActions";
import { maskEmail } from "@/lib/admin/mask";

const STATUS_TONE: Record<string, string> = {
  active: "bg-success-tint text-success-dark",
  expired: "bg-danger-tint text-danger",
  suspended: "bg-gold-tint text-gold",
  disabled: "bg-ink/5 text-slate",
  not_configured: "bg-ink/5 text-slate",
};

const STATUS_OPTIONS = ["active", "expired", "suspended", "disabled", "not_configured"] as const;
const PAGE_SIZE = 20;

export function OwnerSearchPanel() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OwnerSearchPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  function runSearch(q: string, status: string, nextPage: number) {
    setError(null);
    startTransition(async () => {
      const result = await searchOwners(q, status || undefined, nextPage, PAGE_SIZE);
      setHasSearched(true);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setData(result.data);
      setPage(nextPage);
    });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">Owner Management</p>
      <p className="mt-1 text-sm text-ink-soft">
        Search by owner name, email, or business name — Owner → Businesses → Branches.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query, statusFilter, 1);
        }}
        className="mt-3 flex flex-wrap gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search owners…"
          className="flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3 py-2 text-sm text-ink"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-2.5 py-2 text-sm text-ink"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[var(--radius-sm)] bg-verified px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Search
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {isPending && <p className="mt-3 text-sm text-slate">Searching…</p>}

      {!isPending && hasSearched && data && data.results.length === 0 && (
        <p className="mt-3 text-sm text-slate">No owners found matching that search.</p>
      )}

      {!isPending && data && data.results.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {data.results.map((owner) => (
            <Link
              key={owner.ownerId}
              href={`/admin/owners/${owner.ownerId}`}
              className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-3.5 shadow-xs hover:border-verified/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-ink">{owner.fullName ?? maskEmail(owner.email)}</p>
                <p className="text-xs text-slate">{maskEmail(owner.email)}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span>
                  {owner.businessCount} business{owner.businessCount === 1 ? "" : "es"}
                </span>
                <span>·</span>
                <span>
                  {owner.branchCount} branch{owner.branchCount === 1 ? "" : "es"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    STATUS_TONE[owner.subscriptionStatus] ?? STATUS_TONE.not_configured
                  }`}
                >
                  {owner.subscriptionStatus.replace("_", " ")}
                </span>
              </div>
            </Link>
          ))}

          {totalPages > 1 && (
            <div className="mt-1 flex items-center justify-between text-xs text-slate">
              <button
                type="button"
                disabled={isPending || page <= 1}
                onClick={() => runSearch(query, statusFilter, page - 1)}
                className="rounded-[var(--radius-sm)] border border-border-strong px-2.5 py-1 disabled:opacity-40"
              >
                ← Previous
              </button>
              <span>
                Page {page} of {totalPages} · {data.totalCount} owner{data.totalCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                disabled={isPending || page >= totalPages}
                onClick={() => runSearch(query, statusFilter, page + 1)}
                className="rounded-[var(--radius-sm)] border border-border-strong px-2.5 py-1 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
