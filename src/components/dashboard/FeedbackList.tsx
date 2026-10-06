import Link from "next/link";
import { ReviewGenerator } from "@/components/dashboard/ReviewGenerator";

interface Submission {
  id: string;
  rating: number;
  tags: string[];
  message: string | null;
  ai_draft: string | null;
  final_draft: string | null;
  created_at: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${i < rating ? "fill-gold" : "fill-none stroke-border-strong"}`}
          strokeWidth={i < rating ? 0 : 1.5}
        >
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
        </svg>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function FeedbackList({
  submissions,
  distribution,
  totalScanned,
  selectedRating,
  distributionCapped,
}: {
  submissions: Submission[];
  distribution: { rating: number; count: number }[];
  totalScanned: number;
  selectedRating: number | null;
  distributionCapped: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/feedback"
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            selectedRating === null
              ? "border-verified bg-verified-tint text-verified-dark"
              : "border-border-strong text-ink-soft hover:border-ink"
          }`}
        >
          All ({totalScanned}
          {distributionCapped ? "+" : ""})
        </Link>
        {distribution
          .slice()
          .reverse()
          .map(({ rating, count }) => (
            <Link
              key={rating}
              href={`/dashboard/feedback?rating=${rating}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                selectedRating === rating
                  ? "border-verified bg-verified-tint text-verified-dark"
                  : "border-border-strong text-ink-soft hover:border-ink"
              }`}
            >
              {rating}★ ({count})
            </Link>
          ))}
      </div>

      {distributionCapped && (
        <p className="text-xs text-slate">
          Showing distribution for your most recent {totalScanned} submissions.
          A full aggregated count is planned for the Analytics module.
        </p>
      )}

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-8 text-center text-sm text-slate">
          {selectedRating
            ? `No ${selectedRating}-star feedback yet.`
            : "No feedback yet. Once customers scan your QR code, it'll show up here."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {submissions.map((s) => {
            const usedDraft = s.final_draft && s.final_draft !== s.message;
            return (
              <li
                key={s.id}
                className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StarRow rating={s.rating} />
                  <span className="text-xs text-slate">{formatDate(s.created_at)}</span>
                </div>

                {s.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-ink-soft"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {s.message && (
                  <div className="mt-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
                      What they told us
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{s.message}</p>
                  </div>
                )}

                {usedDraft && (
                  <div className="mt-3 rounded-md bg-paper px-3.5 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
                      Draft they submitted{s.ai_draft ? " (AI-assisted)" : ""}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.final_draft}</p>
                  </div>
                )}

                {!s.message && !usedDraft && (
                  <p className="mt-3 text-sm text-slate">
                    No written feedback — rating and tags only.
                  </p>
                )}

                <ReviewGenerator submissionId={s.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
