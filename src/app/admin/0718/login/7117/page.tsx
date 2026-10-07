"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Separate admin sign-in. Reachable only at /admin/0718/login/7117 and
 * deliberately not linked from anywhere in the app.
 *
 * After a successful password check, we confirm the account is actually an
 * admin with an active role assignment. If not, the session is signed out
 * immediately so this page can never be used to sign in a regular owner.
 * (The real authorization boundary is still the server-side check in the
 * admin layout + RLS — this is just a clean UX gate.)
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setLoading(false);
      setErrors({ form: "Incorrect email or password." });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const { data: assignment } = await supabase
      .from("admin_role_assignments")
      .select("admin_role")
      .eq("user_id", data.user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (profile?.role !== "admin" || !assignment) {
      await supabase.auth.signOut();
      setLoading(false);
      setErrors({ form: "This account does not have admin access." });
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <AuthShell title="Admin sign in" subtitle="Authorized administrators only.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && <Alert tone="error">{errors.form}</Alert>}
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
        <Field label="Password" htmlFor="password" error={errors.password} required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!errors.password}
          />
        </Field>
        <Button type="submit" loading={loading} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
