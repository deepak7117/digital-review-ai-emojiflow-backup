/**
 * Turns a business name into a URL-safe slug, e.g. "Joe's Café & Bar"
 * -> "joes-cafe-bar". Falls back to "business" if nothing survives.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");

  return slug || "business";
}

/**
 * Generates a short random suffix using the platform's crypto API, safe for
 * use in a public URL / QR code (base36, lowercase, no separators).
 */
export function randomSuffix(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

/**
 * Builds a candidate public_code for a new feedback link:
 * "<business-slug>-<random>". The caller is responsible for retrying with a
 * new random suffix if the value collides with an existing unique column.
 */
export function generateFeedbackCode(businessName: string): string {
  return `${slugify(businessName)}-${randomSuffix()}`;
}
