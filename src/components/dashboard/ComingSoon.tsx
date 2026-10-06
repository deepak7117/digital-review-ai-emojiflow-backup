export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex max-w-lg flex-col gap-3">
      <span className="w-fit rounded-full bg-ink/5 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate">
        Coming soon
      </span>
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
    </div>
  );
}
