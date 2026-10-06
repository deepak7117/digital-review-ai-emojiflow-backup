import Link from "next/link";

export function FinalCta() {
  return (
    <section className="border-b border-border bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-16 md:flex-row md:items-center">
        <h2 className="max-w-md font-display text-3xl font-semibold tracking-tight text-paper-raised">
          Start collecting better feedback
        </h2>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-lg bg-paper-raised px-7 py-3.5 text-base font-medium text-ink transition-colors hover:bg-paper"
        >
          Get started
        </Link>
      </div>
    </section>
  );
}
