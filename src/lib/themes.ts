export const DEFAULT_THEME = "default";

export const THEME_COOKIE_NAME = "active_theme";

export type ColorTheme = {
  /** Value stored in the cookie and used as the `theme-*` body class suffix. */
  value: string;
  label: string;
  /** Representative light-mode swatch colors used in the theme picker preview. */
  swatch: { primary: string; secondary: string; accent: string };
};

export const COLOR_THEMES: ColorTheme[] = [
  {
    value: "default",
    label: "Default",
    swatch: {
      primary: "oklch(0.205 0 0)",
      secondary: "oklch(0.97 0 0)",
      accent: "oklch(0.97 0 0)",
    },
  },
  {
    value: "teenage-lobster",
    label: "Teenage Lobster",
    swatch: {
      primary: "oklch(0.6707 0.2213 37.6393)",
      secondary: "oklch(0.3705 0 0)",
      accent: "oklch(0.9589 0.0198 44.7807)",
    },
  },
  {
    value: "claude",
    label: "Claude",
    swatch: {
      primary: "oklch(0.6171 0.1375 39.0427)",
      secondary: "oklch(0.9245 0.0138 92.9892)",
      accent: "oklch(0.9245 0.0138 92.9892)",
    },
  },
  {
    value: "mx-brutalist",
    label: "MX Brutalist",
    swatch: {
      primary: "oklch(0.5687 0.1498 151.9380)",
      secondary: "oklch(0.6088 0.2498 29.2339)",
      accent: "oklch(0.7721 0.1727 64.1585)",
    },
  },
];

export function isValidTheme(value: string | undefined): value is string {
  return !!value && COLOR_THEMES.some((theme) => theme.value === value);
}
