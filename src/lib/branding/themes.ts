/**
 * Curated accent themes for the customer-facing feedback experience.
 * Deliberately a small, fixed set — not a free color picker — so every
 * combination is guaranteed to stay premium and accessible (sufficient
 * contrast against white button text), per the approved design
 * constraint. The stored value (businesses.brand_theme) is validated
 * against this exact set both here and via a database CHECK constraint.
 */

export type ThemeId =
  | "default"
  | "midnight_gold"
  | "ocean_blue"
  | "emerald"
  | "royal_purple"
  | "warm_sand"
  | "graphite";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  accent: string;
  accentDark: string;
  accentTint: string;
  gradient: string;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  default: {
    id: "default",
    name: "BD Clarity — Default",
    accent: "#c1611e",
    accentDark: "#9c4e18",
    accentTint: "#fbeee2",
    gradient: "linear-gradient(135deg, #c1611e 0%, #e2934f 100%)",
  },
  midnight_gold: {
    id: "midnight_gold",
    name: "Midnight Gold",
    accent: "#b8902f",
    accentDark: "#8f701f",
    accentTint: "#f7efd9",
    gradient: "linear-gradient(135deg, #8f701f 0%, #d4af5a 100%)",
  },
  ocean_blue: {
    id: "ocean_blue",
    name: "Ocean Blue",
    accent: "#1d6fa5",
    accentDark: "#155480",
    accentTint: "#e1eef6",
    gradient: "linear-gradient(135deg, #155480 0%, #3f98cf 100%)",
  },
  emerald: {
    id: "emerald",
    name: "Emerald",
    accent: "#1f7a5c",
    accentDark: "#155c45",
    accentTint: "#e1f1ec",
    gradient: "linear-gradient(135deg, #155c45 0%, #2fa47d 100%)",
  },
  royal_purple: {
    id: "royal_purple",
    name: "Royal Purple",
    accent: "#6b4ba8",
    accentDark: "#533a86",
    accentTint: "#ece6f5",
    gradient: "linear-gradient(135deg, #533a86 0%, #8c6bd1 100%)",
  },
  warm_sand: {
    id: "warm_sand",
    name: "Warm Sand",
    accent: "#a67c52",
    accentDark: "#8a6440",
    accentTint: "#f3ebe0",
    gradient: "linear-gradient(135deg, #8a6440 0%, #c49f71 100%)",
  },
  graphite: {
    id: "graphite",
    name: "Graphite",
    accent: "#4a5160",
    accentDark: "#363b47",
    accentTint: "#e9eaed",
    gradient: "linear-gradient(135deg, #363b47 0%, #6b7383 100%)",
  },
};

export const THEME_LIST: ThemeDefinition[] = Object.values(THEMES);

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

export function getTheme(id: string | null | undefined): ThemeDefinition {
  if (id && isValidThemeId(id)) return THEMES[id];
  return THEMES.default;
}

/** CSS custom-property overrides for one theme — applied inline, scoped to the customer feedback page only, never touching the global design tokens used everywhere else. */
export function themeCssVars(theme: ThemeDefinition): React.CSSProperties {
  return {
    "--color-verified": theme.accent,
    "--color-verified-dark": theme.accentDark,
    "--color-verified-tint": theme.accentTint,
    "--gradient-brand": theme.gradient,
  } as React.CSSProperties;
}
