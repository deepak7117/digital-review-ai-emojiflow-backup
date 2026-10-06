import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listConnections } from "@/app/dashboard/settings/google/actions";
import { isGoogleIntegrationAvailable } from "@/lib/google/oauth";
import { GoogleConnectionPanel } from "@/components/dashboard/GoogleConnectionPanel";

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pendingConnectionId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/dashboard/settings/google");

  const { error: callbackError, pendingConnectionId } = await searchParams;

  const connectionsResult = await listConnections();
  const connections = "data" in connectionsResult ? connectionsResult.data : [];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Google Business Profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Connect your Google Business Profile to unlock future review insights.
        This does not change your existing Google review link — that keeps working
        exactly as it does today, as a permanent fallback.
      </p>

      <div className="mt-6">
        <GoogleConnectionPanel
          available={isGoogleIntegrationAvailable()}
          initialConnections={connections}
          callbackError={callbackError ?? null}
          pendingConnectionId={pendingConnectionId ?? null}
        />
      </div>
    </div>
  );
}
