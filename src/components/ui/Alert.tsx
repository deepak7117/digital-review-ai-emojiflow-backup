import type { ReactNode } from "react";

type Tone = "success" | "error" | "info";

const toneStyles: Record<Tone, string> = {
  success: "bg-verified-tint text-verified-dark border-verified/20",
  error: "bg-danger-tint text-danger border-danger/20",
  info: "bg-ink/5 text-ink-soft border-ink/10",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[var(--radius-sm)] border px-4 py-3 text-sm shadow-xs ${toneStyles[tone]}`}
    >
      {children}
    </div>
  );
}
