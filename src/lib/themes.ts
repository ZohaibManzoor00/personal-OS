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
    value: "modern-minimal",
    label: "Modern Minimal",
    swatch: {
      primary: "oklch(0.6231 0.188 259.8145)",
      secondary: "oklch(0.967 0.0029 264.5419)",
      accent: "oklch(0.9514 0.025 236.8242)",
    },
  },
  {
    value: "t3-chat",
    label: "T3 Chat",
    swatch: {
      primary: "oklch(0.5316 0.1409 355.1999)",
      secondary: "oklch(0.8696 0.0675 334.8991)",
      accent: "oklch(0.8696 0.0675 334.8991)",
    },
  },
  {
    value: "mono",
    label: "Mono",
    swatch: {
      primary: "oklch(0.5555 0 0)",
      secondary: "oklch(0.9702 0 0)",
      accent: "oklch(0.9702 0 0)",
    },
  },
];

export function isValidTheme(value: string | undefined): value is string {
  return !!value && COLOR_THEMES.some((theme) => theme.value === value);
}
