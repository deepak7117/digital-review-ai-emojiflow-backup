import Link from "next/link";
import type { Period } from "@/lib/insights/period";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export function PeriodSelector({ selected }: { selected: Period }) {
  return (
    <div className="flex gap-2">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={`/dashboard/intelligence?period=${p.value}`}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            selected === p.value
              ? "border-verified bg-verified-tint text-verified-dark"
              : "border-border-strong text-ink-soft hover:border-ink"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
