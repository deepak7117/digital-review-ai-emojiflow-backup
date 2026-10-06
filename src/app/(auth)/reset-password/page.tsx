"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (confirmPassword !== password) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <AuthShell title="Set a new password" subtitle="This link is only valid for a short time.">
      {success ? (
        <Alert tone="success">Password updated. Taking you to your dashboard…</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {errors.form && <Alert tone="error">{errors.form}</Alert>}
          <Field label="New password" htmlFor="password" error={errors.password} required>
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
          <Field
            label="Confirm new password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword}
            required
          >
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              invalid={!!errors.confirmPassword}
            />
          </Field>
          <Button type="submit" loading={loading} className="mt-1 w-full">
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
