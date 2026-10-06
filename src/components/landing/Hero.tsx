import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { branding } from "@/lib/config/branding";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 pb-20 pt-16 md:grid-cols-2 md:items-center md:pt-24 md:pb-28">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-paper-raised px-3 py-1 text-xs font-mono uppercase tracking-wide text-slate">
            For local businesses
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            {branding.tagline}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft">
            {branding.productName} gives every customer a QR code to scan and a few
            honest questions to answer. We help them put their real experience
            into words — never someone else&rsquo;s.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup">
              <Button size="lg">Get started</Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>
          <p className="mt-6 text-xs text-slate">
            No credit card required to get started · Set up in a few minutes
          </p>
        </div>

        {/* Signature element: raw feedback becoming a grounded draft, never fabricated */}
        <div className="relative">
          <div className="relative rounded-xl border border-border-strong bg-paper-raised p-5 shadow-[0_1px_0_rgba(20,33,61,0.04)]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
              What the customer typed
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              &ldquo;food came fast, server was really nice, place was a bit loud but
              we had a good time overall&rdquo;
            </p>
          </div>

          <div className="my-3 flex items-center gap-3 pl-2">
            <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-verified">
              shaped into a draft
            </span>
            <div className="h-px flex-1 bg-border-strong" aria-hidden="true" />
          </div>

          <div className="relative rounded-xl border border-verified/25 bg-verified-tint p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-verified-dark">
                Review draft
              </p>
              <div className="flex gap-0.5" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-gold">
                    <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              Food came out quickly and our server was genuinely attentive. It
              got a little loud during the rush, but that didn&rsquo;t take away
              from a good evening overall.
            </p>
            <p className="mt-4 text-xs text-verified-dark">
              Edited and sent to Google by the customer — not us.
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-slate">
            Grounded in what the customer said. Nothing invented, ever.
          </p>
        </div>
      </div>
    </section>
  );
}
