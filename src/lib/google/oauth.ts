import "server-only";
import crypto from "node:crypto";
import { isTokenEncryptionConfigured } from "./tokenCrypto";

/**
 * Google OAuth 2.0 authorization-code flow for Business Profile access.
 *
 * Scope: uses ONLY https://www.googleapis.com/auth/business.manage — the
 * single scope Google's own documentation specifies for Business Profile
 * API access (verified against current official Google documentation as
 * part of this milestone's inspection). No broader scope is requested.
 *
 * IMPORTANT, stated plainly: this scope is classified "Sensitive" by
 * Google, and using it in production requires a real, Google-reviewed app
 * verification — separate from and in addition to writing this code. This
 * has NOT been exercised against a live Google Cloud project or real
 * Google servers in this environment; there is no way to test an actual
 * OAuth round-trip without a registered OAuth client (GOOGLE_OAUTH_
 * CLIENT_ID/SECRET) and a Google-approved redirect URI, neither of which
 * exist here. See the Milestone 1 report for exactly what remains
 * externally blocked.
 */

const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/business.manage";
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

/** True only when BOTH the OAuth client is configured AND token encryption is available — the whole feature fails closed if either is missing. */
export function isGoogleIntegrationAvailable(): boolean {
  return isGoogleOAuthConfigured() && isTokenEncryptionConfigured();
}

/** A random, single-use CSRF token — verified against the session on callback before any code exchange happens. */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildGoogleAuthorizationUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("Google OAuth is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // ensures a refresh_token is returned even on repeat connections
    state,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

/**
 * Exchanges an authorization code for tokens. Real Google token-endpoint
 * call — correct per current OAuth 2.0 / Google documentation, but never
 * exercised against a live Google server in this environment (see file
 * header).
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;

  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data?.access_token !== "string") return null;

    return {
      accessToken: data.access_token,
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null,
      expiresAt: new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000),
    };
  } catch {
    return null;
  }
}

/** Refreshes an expired access token using the stored refresh token. Same untested-against-live-Google caveat as above. */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data?.access_token !== "string") return null;

    return {
      accessToken: data.access_token,
      refreshToken, // Google does not re-issue a refresh token on refresh; keep the existing one.
      expiresAt: new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000),
    };
  } catch {
    return null;
  }
}
