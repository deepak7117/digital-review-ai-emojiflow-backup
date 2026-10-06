/**
 * Default set of optional experience tags shown on a business's public
 * feedback page. Stored per-business in feedback_links.tags so a future
 * module can let owners customize this list without a schema change —
 * for now every new feedback link is created with this default set.
 */
export const DEFAULT_FEEDBACK_TAGS = [
  "Service",
  "Staff",
  "Quality",
  "Cleanliness",
  "Value",
  "Ambience",
  "Speed",
] as const;
