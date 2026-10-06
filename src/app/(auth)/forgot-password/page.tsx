"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    // Always show the same confirmation, whether or not the email exists,
    // so we don't leak which emails have accounts.
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to reset it."
      footer={
        <Link href="/login" className="font-medium text-verified hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">
          If an account exists for {email}, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Email" htmlFor="email" error={error ? undefined : undefined} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="mt-1 w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
