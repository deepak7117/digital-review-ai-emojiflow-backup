import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { encryptToken, isTokenEncryptionConfigured } from "@/lib/google/tokenCrypto";
import { getActiveBusinessId } from "@/lib/business/activeBusiness";

/**
 * Google OAuth callback. Server-only route — the authorization code
 * arrives here from Google as a query parameter (standard OAuth
 * redirect), and everything from this point on (code exchange, token
 * storage) happens entirely server-side. The response to the browser is
 * always just a redirect — never a token, never a code, never anything
 * sensitive in the URL or body.
 */
export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/dashboard/settings/google", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    settingsUrl.searchParams.set("error", "The Google authorization was cancelled or denied.");
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("error", "Missing authorization response from Google.");
    return NextResponse.redirect(settingsUrl);
  }

  // CSRF protection: the state value must match the one this server set in
  // an httpOnly cookie when the flow started (see startGoogleConnect()
  // server action) — never trust the state param alone.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!expectedState || expectedState !== state) {
    settingsUrl.searchParams.set("error", "This authorization request could not be verified. Please try again.");
    return NextResponse.redirect(settingsUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?redirectTo=/dashboard/settings/google", request.url));
  }

  const businessId = await getActiveBusinessId(supabase);

  if (!businessId) {
    settingsUrl.searchParams.set("error", "Set up your business profile first.");
    return NextResponse.redirect(settingsUrl);
  }

  if (!isTokenEncryptionConfigured()) {
    settingsUrl.searchParams.set("error", "Google integration is not fully configured on this server.");
    return NextResponse.redirect(settingsUrl);
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens || !tokens.refreshToken) {
    settingsUrl.searchParams.set(
      "error",
      "Could not complete the Google connection. Please try again."
    );
    return NextResponse.redirect(settingsUrl);
  }

  // Encrypted before ever touching the database — the raw tokens exist
  // only in this function's memory, never in a response to the browser.
  const accessTokenEncrypted = encryptToken(tokens.accessToken);
  const refreshTokenEncrypted = encryptToken(tokens.refreshToken);

  const { data: connection, error: insertError } = await supabase
    .from("google_business_connections")
    .insert({
      business_id: businessId,
      // bytea columns via PostgREST: hex-encoded, \x-prefixed text form.
      access_token_encrypted: `\\x${accessTokenEncrypted.toString("hex")}`,
      refresh_token_encrypted: `\\x${refreshTokenEncrypted.toString("hex")}`,
      token_expires_at: tokens.expiresAt.toISOString(),
      connected_by: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !connection) {
    settingsUrl.searchParams.set("error", "Could not save the Google connection. Please try again.");
    return NextResponse.redirect(settingsUrl);
  }

  settingsUrl.searchParams.set("pendingConnectionId", connection.id);
  return NextResponse.redirect(settingsUrl);
}
