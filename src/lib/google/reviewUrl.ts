/**
 * Best-effort check that a URL looks like a Google review/maps link.
 *
 * This is deliberately non-authoritative: Google has several legitimate
 * link shapes (g.page/r/..., maps.app.goo.gl/..., search.google.com/local/
 * writereview?placeid=..., goo.gl/maps/..., google.com/maps/place/...), and
 * new ones may exist that aren't listed here. Callers should treat a
 * "false" result as a soft warning to double-check, never as a reason to
 * block saving — a business owner pasting their actual, working link is
 * always right, even if it doesn't match a pattern we know about.
 */
const KNOWN_GOOGLE_HOSTS = [
  "g.page",
  "goo.gl",
  "maps.app.goo.gl",
  "google.com",
  "search.google.com",
  "maps.google.com",
];

export function looksLikeGoogleReviewUrl(url: string): boolean {
  if (!url || !url.trim()) return false;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  return KNOWN_GOOGLE_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}
