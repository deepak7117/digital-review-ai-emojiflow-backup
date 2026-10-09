"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

function ChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === "verified");
    if (factorsError || !factor) {
      setLoading(false);
      setError("No verified authenticator found for this account.");
      return;
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setLoading(false);

    if (error) {
      setError("Incorrect code. Please try again.");
      return;
    }

    const redirectTo = searchParams.get("redirectTo") || "/admin";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <AuthShell title="Verification required" subtitle="Enter the code from your authenticator app.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit code"
          className="rounded-[var(--radius-sm)] border border-border-strong bg-paper px-3 py-2.5 text-center text-lg tracking-widest text-ink"
        />
        <Button type="submit" loading={loading} disabled={code.length !== 6}>
          Verify
        </Button>
      </form>
    </AuthShell>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense>
      <ChallengeForm />
    </Suspense>
  );
}
