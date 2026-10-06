import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function FeedbackNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <Logo compact />
      <h1 className="font-display text-xl font-semibold text-ink">
        This feedback link isn&rsquo;t available
      </h1>
      <p className="max-w-sm text-sm text-ink-soft">
        It may have been paused by the business, or the link may be incorrect.
        If you scanned a QR code, please check with the business directly.
      </p>
      <Link href="/" className="text-sm font-medium text-verified hover:underline">
        Go to homepage
      </Link>
    </div>
  );
}
