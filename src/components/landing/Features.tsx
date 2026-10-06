const features = [
  {
    title: "QR Feedback",
    body: "A unique QR code for your business that opens a simple feedback flow — no app required.",
  },
  {
    title: "AI Review Assistant",
    body: "Helps customers turn their own words into a clear, natural review draft.",
  },
  {
    title: "Google Review Support",
    body: "Makes it easy for a customer to take their finished draft to Google, in their own words.",
  },
  {
    title: "Customer Insights",
    body: "See the themes in what customers are actually telling you, good and bad.",
  },
  {
    title: "Business Dashboard",
    body: "One place to manage your profile, your QR flow, and what customers are saying.",
  },
  {
    title: "Reputation Analytics",
    body: "Track how feedback and reviews trend over time as you make changes.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-lg">
          <p className="font-mono text-xs uppercase tracking-wider text-verified">What&rsquo;s coming</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            Built to grow with your business
          </h2>
          <p className="mt-3 text-sm text-ink-soft">
            Module 1 ships the foundation below. These are on the roadmap next.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-paper-raised p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-ink">{f.title}</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
                  soon
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
