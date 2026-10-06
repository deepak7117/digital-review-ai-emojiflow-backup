"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function validate() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }

    // If email confirmation is off, Supabase returns an active session and
    // we can go straight to the dashboard. Otherwise, ask the user to check
    // their inbox.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setNotice("Check your inbox to confirm your email before logging in.");
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your business in a few minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-verified hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {notice ? (
        <Alert tone="success">{notice}</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {errors.form && <Alert tone="error">{errors.form}</Alert>}
          <Field label="Full name" htmlFor="fullName" error={errors.fullName} required>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              invalid={!!errors.fullName}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!errors.email}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password}
            hint={!errors.password ? "At least 8 characters." : undefined}
            required
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!errors.password}
            />
          </Field>
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Create account
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
