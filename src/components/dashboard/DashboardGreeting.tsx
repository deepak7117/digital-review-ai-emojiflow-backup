"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Client-only by necessity: a Server Component has no way to know the
 * owner's actual local time (only the server's, or a guess from request
 * headers) — this reads the real browser clock. Renders a neutral
 * fallback for the one frame before mount rather than guessing, avoiding
 * a wrong greeting flashing before the correct one appears.
 */
export function DashboardGreeting({
  ownerName,
  businessName,
}: {
  ownerName: string | null;
  businessName: string | null;
}) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  const who = ownerName ? `, ${ownerName}` : "";

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {greeting ?? "Welcome back"}
        {who} <span aria-hidden="true">👋</span>
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Here&rsquo;s what&rsquo;s happening with{" "}
        {businessName ? businessName : "your business"} today.
      </p>
    </div>
  );
}
