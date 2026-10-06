import type { ExperienceScoreResult } from "@/lib/insights/experienceScore";

export function ExperienceScoreCard({ result }: { result: ExperienceScoreResult }) {
  if (result.score === null) {
    return (
      <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          📊 Customer Experience Score
        </p>
        <p className="mt-3 text-sm text-slate">
          Not enough data to calculate a reliable score yet
          {result.totalFeedback > 0 ? ` (${result.totalFeedback} submissions so far)` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-strong bg-paper-raised p-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
        📊 Customer Experience Score
      </p>
      <p className="mt-2 font-display text-3xl font-semibold text-ink">{result.score} / 100</p>
      <p className="mt-1 text-xs text-slate">Based on {result.totalFeedback} submissions</p>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm font-medium text-verified hover:underline">
          Why this score?
        </summary>
        <ul className="mt-3 flex flex-col gap-2">
          {result.factors.map((factor) => (
            <li key={factor.label} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="text-ink-soft">{factor.label}</p>
                <p className="text-xs text-slate">{factor.detail}</p>
              </div>
              <span
                className={`shrink-0 font-mono text-sm ${
                  factor.contribution >= 0 ? "text-verified" : "text-danger"
                }`}
              >
                {factor.contribution >= 0 ? "+" : ""}
                {factor.contribution}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
