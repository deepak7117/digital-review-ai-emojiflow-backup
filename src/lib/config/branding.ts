/**
 * Central branding configuration.
 *
 * The product name, tagline, and parent brand are WORKING values and are
 * expected to change before public launch. Every place in the app that
 * needs to display these values should import them from here rather than
 * hard-coding a string. Do not scatter "BD Clarity" or
 * "Banao Digital" through components — always reference this file.
 */

export const branding = {
  /** Working product name. Temporary — expected to change. */
  productName: "BD Clarity",

  /** Short form used in tight spaces (nav bar, favicon alt text, etc). */
  productShortName: "BD Clarity",

  /** Parent company / brand. */
  parentBrand: "Banao Digital",

  /** Working tagline shown on the landing page hero and metadata. */
  tagline: "Turn Customer Feedback Into Better Reviews.",

  /** One-line description used for SEO / meta tags. */
  description:
    "BD Clarity helps local businesses collect genuine customer feedback through a QR code, and helps customers turn their real experience into a natural review draft.",

  /** Support / contact email placeholder. Update before launch. */
  supportEmail: "hello@banaodigital.com",

  /** Current year, used in footer copyright. */
  copyrightYear: new Date().getFullYear(),
} as const;

export type Branding = typeof branding;
