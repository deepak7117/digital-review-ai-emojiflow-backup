"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

/** Reuses the exact same sign-out call already used in Header.tsx — not a second sign-out implementation, just a second place to trigger the same real action. */
export function SettingsSignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout} loading={loggingOut}>
      Sign out
    </Button>
  );
}
