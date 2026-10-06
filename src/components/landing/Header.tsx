import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          <a href="#how-it-works" className="text-sm text-ink-soft hover:text-ink transition-colors">
            How it works
          </a>
          <a href="#features" className="text-sm text-ink-soft hover:text-ink transition-colors">
            Features
          </a>
          <a href="#trust" className="text-sm text-ink-soft hover:text-ink transition-colors">
            Our promise
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline text-sm font-medium text-ink-soft hover:text-ink transition-colors">
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
