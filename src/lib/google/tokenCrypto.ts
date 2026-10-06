import "server-only";
import crypto from "node:crypto";

/**
 * Encrypts/decrypts Google OAuth tokens before they ever reach the
 * database. Deliberately application-layer (Node's built-in `crypto`, no
 * new dependency) rather than SQL-side (pgcrypto) encryption — this keeps
 * the encryption key purely a server-side process.env value, exactly like
 * every other secret in this project (AI_PROVIDER_API_KEY,
 * GOOGLE_PLACES_API_KEY), never touching the database layer at all.
 *
 * Format stored in the database: the ciphertext, IV, and auth tag are
 * concatenated into one buffer (IV || authTag || ciphertext) — this is
 * what's stored in the `bytea` columns, never anything raw.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM
const AUTH_TAG_LENGTH = 16;

export function isTokenEncryptionConfigured(): boolean {
  const key = process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  // Must be a 32-byte key, provided as 64 hex characters.
  return Boolean(key && /^[0-9a-fA-F]{64}$/.test(key));
}

function getKey(): Buffer {
  const key = process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY is not configured (expected 64 hex characters = 32 bytes)."
    );
  }
  return Buffer.from(key, "hex");
}

export function encryptToken(plaintext: string): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptToken(stored: Buffer): string {
  const iv = stored.subarray(0, IV_LENGTH);
  const authTag = stored.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = stored.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
