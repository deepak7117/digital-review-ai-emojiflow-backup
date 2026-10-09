/**
 * Masking for admin LIST/scan views, where recognizing an owner among
 * many doesn't require their full email — unlike a single-owner detail
 * page, where the full address is genuinely needed (e.g. to actually
 * target the password-reset action, or to correlate with an audit log
 * entry precisely). Detail pages intentionally continue showing the
 * full value; only list contexts use these.
 */

export function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return email; // not a well-formed email; show as-is rather than mangle it
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 4))}@${domain}`;
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}
