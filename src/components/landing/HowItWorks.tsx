const steps = [
  {
    n: "01",
    title: "Customer scans your QR",
    body: "Print it on a receipt, table tent, or counter card. No app, no login — just a scan.",
  },
  {
    n: "02",
    title: "Customer shares their experience",
    body: "A short, honest set of prompts. Customers answer in their own words, at their own pace.",
  },
  {
    n: "03",
    title: "AI helps shape it into a review draft",
    body: "We turn their answers into a natural, readable draft. They read it, edit it, and choose whether to post it.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-lg">
          <p className="font-mono text-xs uppercase tracking-wider text-verified">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            Three steps. The customer stays in control the whole way.
          </h2>
        </div>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <li key={step.n} className="relative border-t border-border-strong pt-5">
              <span className="font-mono text-sm text-slate">{step.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
