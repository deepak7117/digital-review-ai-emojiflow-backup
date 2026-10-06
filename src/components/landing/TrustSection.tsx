const commitments = [
  "We never write a review the customer didn't say, in substance, themselves.",
  "We never hide or discourage negative feedback from reaching you.",
  "We never selectively route only happy customers to Google.",
  "The customer always sees, edits, and approves their draft before it goes anywhere.",
];

export function TrustSection() {
  return (
    <section id="trust" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-xl border border-border-strong bg-paper-raised p-8 md:p-12">
          <p className="font-mono text-xs uppercase tracking-wider text-verified">Our promise</p>
          <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-tight text-ink">
            Genuine feedback, never manufactured
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
            The AI Review Assistant is a writing aid, not a reputation filter.
            It helps a customer express what actually happened — nothing more.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {commitments.map((c) => (
              <li key={c} className="flex items-start gap-3">
                <svg
                  viewBox="0 0 20 20"
                  className="mt-0.5 h-4 w-4 shrink-0 fill-verified"
                  aria-hidden="true"
                >
                  <path d="M8 13.4 4.6 10l-1.4 1.4L8 16.2 17 7.2l-1.4-1.4z" />
                </svg>
                <span className="text-sm leading-relaxed text-ink-soft">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
