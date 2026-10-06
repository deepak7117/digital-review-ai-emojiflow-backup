import { branding } from "@/lib/config/branding";

export function WhySection() {
  return (
    <section className="border-b border-border bg-paper-raised">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-verified">
            Why {branding.productShortName}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            Two sides of the same problem
          </h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="font-display text-base font-semibold text-ink">
              Customers want to say something
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              They had an experience worth mentioning, but staring at a blank
              review box is enough friction to make them close the tab.
            </p>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-ink">
              Businesses want it genuine
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Chasing reviews manually doesn&rsquo;t scale, and nobody wants
              feedback that&rsquo;s been coached or filtered. {branding.productShortName}
              {" "}gives customers an easy on-ramp instead.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
