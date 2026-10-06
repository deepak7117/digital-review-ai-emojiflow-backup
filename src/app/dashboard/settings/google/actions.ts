"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  isGoogleIntegrationAvailable,
  buildGoogleAuthorizationUrl,
  generateOAuthState,
  refreshAccessToken,
} from "@/lib/google/oauth";
import { listGoogleAccounts, listGoogleLocations, type GoogleAccount, type GoogleLocation } from "@/lib/google/businessProfileClient";
import { encryptToken, decryptToken } from "@/lib/google/tokenCrypto";
import { writeAuditLog } from "@/lib/admin/permissions";

/**
 * Every function below re-resolves the caller's OWN business server-side
 * from the session — never trusts a business id supplied by the client —
 * exactly the same defense-in-depth pattern already used throughout this
 * project (qr-feedback/actions.ts, profile/questionsActions.ts, etc.).
 * RLS is the real boundary; this is the second, redundant layer.
 */
async function getOwnedBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ businessId: string; userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be logged in." };

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!business) return { error: "Set up your business profile first." };

  return { businessId: business.id, userId: user.id };
}


/** Starts the OAuth flow: sets a short-lived, httpOnly CSRF-state cookie and returns the URL to redirect the browser to. */
export async function startGoogleConnect(): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  if (!isGoogleIntegrationAvailable()) {
    return { error: "Google integration is not configured on this server yet." };
  }

  const state = generateOAuthState();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes — long enough for the OAuth round-trip, short enough to limit CSRF-token lifetime
    path: "/",
  });

  return { url: buildGoogleAuthorizationUrl(state) };
}

export interface ConnectionSummary {
  id: string;
  branchLabel: string | null;
  googleLocationName: string | null;
  status: "pending" | "connected" | "disconnected";
  createdAt: string;
}

/** Lists the caller's OWN business's connections. Never selects the token columns — see the module comment in the migration for why this matters as a real, separate discipline from RLS. */
export async function listConnections(): Promise<{ data: ConnectionSummary[] } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  const { data, error } = await supabase
    .from("google_business_connections")
    .select("id, branch_label, google_location_name, status, created_at")
    .eq("business_id", owned.businessId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  return {
    data: (data ?? []).map((c) => ({
      id: c.id,
      branchLabel: c.branch_label,
      googleLocationName: c.google_location_name,
      status: c.status,
      createdAt: c.created_at,
    })),
  };
}

export interface AvailableLocation extends GoogleLocation {
  accountName: string;
}

/**
 * For a pending connection just created by the OAuth callback: decrypts
 * its access token IN SERVER MEMORY ONLY, calls the Business Profile API
 * to list the accounts/locations the owner can choose from, and returns
 * only the safe, non-token fields to the client. The decrypted token
 * value itself never appears in this function's return value.
 */
export async function listAvailableLocationsForPendingConnection(
  connectionId: unknown
): Promise<{ data: AvailableLocation[] } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };
  if (typeof connectionId !== "string" || !connectionId) return { error: "Invalid connection." };

  const { data: connection, error } = await supabase
    .from("google_business_connections")
    .select("id, access_token_encrypted, refresh_token_encrypted, token_expires_at, status")
    .eq("id", connectionId)
    .eq("business_id", owned.businessId) // redundant with RLS, defense in depth
    .maybeSingle();

  if (error) return { error: error.message };
  if (!connection) return { error: "Connection not found." };
  if (connection.status !== "pending") return { error: "This connection has already been completed." };

  let accessToken: string;
  try {
    accessToken = decryptToken(hexColumnToBuffer(connection.access_token_encrypted));
  } catch {
    return { error: "Could not read the stored Google credentials." };
  }

  // Refresh proactively if the token from the callback is already stale
  // by the time the owner reaches this step.
  if (new Date(connection.token_expires_at) <= new Date()) {
    const refreshToken = decryptToken(hexColumnToBuffer(connection.refresh_token_encrypted));
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) return { error: "Your Google authorization has expired. Please reconnect." };
    accessToken = refreshed.accessToken;
    await supabase
      .from("google_business_connections")
      .update({
        access_token_encrypted: `\\x${encryptToken(refreshed.accessToken).toString("hex")}`,
        token_expires_at: refreshed.expiresAt.toISOString(),
      })
      .eq("id", connectionId);
  }

  const accounts: GoogleAccount[] = await listGoogleAccounts(accessToken);
  const results: AvailableLocation[] = [];
  for (const account of accounts) {
    const locations = await listGoogleLocations(accessToken, account.name);
    for (const loc of locations) {
      results.push({ ...loc, accountName: account.name });
    }
  }

  return { data: results };
}

/** Finalizes a pending connection once the owner has picked a location. */
export async function finalizeConnection(
  connectionId: unknown,
  accountName: unknown,
  locationName: unknown,
  locationTitle: unknown,
  branchLabel: unknown
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };

  if (typeof connectionId !== "string" || !connectionId) return { error: "Invalid connection." };
  if (typeof accountName !== "string" || typeof locationName !== "string") {
    return { error: "Invalid Google location." };
  }
  const label = typeof branchLabel === "string" ? branchLabel.trim().slice(0, 200) || null : null;
  const title = typeof locationTitle === "string" ? locationTitle.slice(0, 200) : locationName;

  const { error } = await supabase
    .from("google_business_connections")
    .update({
      status: "connected",
      google_account_id: accountName,
      google_location_id: locationName,
      google_location_name: title,
      branch_label: label,
    })
    .eq("id", connectionId)
    .eq("business_id", owned.businessId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  await writeAuditLog({
    adminUserId: owned.userId,
    action: "google_business_connect",
    targetType: "business",
    targetId: owned.businessId,
    result: "success",
    metadata: { locationName: title, branchLabel: label },
  });

  revalidatePath("/dashboard/settings/google");
  return { ok: true };
}

/** Disconnects a connection — revokes nothing on Google's side (out of scope; Google's own account settings govern that), just stops BD Clarity from using it. */
export async function disconnectConnection(connectionId: unknown): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const owned = await getOwnedBusinessId(supabase);
  if ("error" in owned) return { error: owned.error };
  if (typeof connectionId !== "string" || !connectionId) return { error: "Invalid connection." };

  const { error } = await supabase
    .from("google_business_connections")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString(), disconnected_by: owned.userId })
    .eq("id", connectionId)
    .eq("business_id", owned.businessId);

  if (error) return { error: error.message };

  await writeAuditLog({
    adminUserId: owned.userId,
    action: "google_business_disconnect",
    targetType: "business",
    targetId: owned.businessId,
    result: "success",
  });

  revalidatePath("/dashboard/settings/google");
  return { ok: true };
}

/** PostgREST returns bytea as a "\x"-prefixed hex string — converts back to a Buffer for decryption. */
function hexColumnToBuffer(value: string): Buffer {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  return Buffer.from(hex, "hex");
}
