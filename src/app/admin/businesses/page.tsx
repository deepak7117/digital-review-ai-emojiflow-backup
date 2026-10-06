import Link from "next/link";
import { searchBusinesses } from "@/app/admin/businesses/actions";

const STATUS_TONE: Record<string, string> = {
  active: "bg-verified-tint text-verified-dark",
  inactive: "bg-ink/5 text-slate",
  suspended: "bg-danger-tint text-danger",
};

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const result = await searchBusinesses(q);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Business Accounts</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {"data" in result ? `${result.data.length} account${result.data.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by business name…"
          className="w-full max-w-sm rounded-md border border-border-strong bg-paper-raised px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-verified/30"
        />
        <button
          type="submit"
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-ink"
        >
          Search
        </button>
      </form>

      {"error" in result ? (
        <div className="rounded-lg border border-danger/25 bg-danger-tint p-4 text-sm text-danger">
          {result.error}
        </div>
      ) : result.data.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-8 text-center text-sm text-slate">
          No businesses found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-strong">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-raised">
              <tr>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate">
                  Business
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate">
                  Owner
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate">
                  Status
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-slate">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/businesses/${b.id}`}
                      className="font-medium text-ink hover:text-verified hover:underline"
                    >
                      {b.businessName}
                    </Link>
                    {(b.category || b.city) && (
                      <p className="text-xs text-slate">
                        {[b.category, b.city].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{b.ownerEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_TONE[b.status]}`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
