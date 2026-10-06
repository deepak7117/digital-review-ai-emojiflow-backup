import type { PriorityLevel } from "@/lib/insights/priority";

const TONE: Record<PriorityLevel, string> = {
  critical: "bg-danger-tint text-danger border-danger/25",
  high: "bg-gold-tint text-gold border-gold/30",
  medium: "bg-ink/5 text-ink-soft border-border-strong",
  low: "bg-ink/5 text-slate border-border-strong",
  monitor: "bg-verified-tint text-verified-dark border-verified/25",
};

export function PriorityBadge({ level, label }: { level: PriorityLevel; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TONE[level]}`}
    >
      {label}
    </span>
  );
}
