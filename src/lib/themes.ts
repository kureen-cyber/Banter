export type ThemeId =
  | "harbor"
  | "syntax-aurora"
  | "terminal-night"
  | "coral-compile"
  | "ocean-diff"
  | "neon-commit";

export type ColorMode = "light" | "dark";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  tagline: string;
  preview: [string, string, string];
};

export const THEMES: ThemeDefinition[] = [
  {
    id: "harbor",
    name: "Harbor Mist",
    tagline: "Calm teal over cool stone — the Banter default.",
    preview: ["#0f766e", "#d8f3ef", "#152238"],
  },
  {
    id: "syntax-aurora",
    name: "Syntax Aurora",
    tagline: "Fluid cyan and lime washes with soft code glyphs.",
    preview: ["#06b6d4", "#84cc16", "#0f172a"],
  },
  {
    id: "terminal-night",
    name: "Terminal Night",
    tagline: "Ink console with amber cursors and green phosphor.",
    preview: ["#22c55e", "#f59e0b", "#0b1220"],
  },
  {
    id: "coral-compile",
    name: "Coral Compile",
    tagline: "Warm peach and rose fluid fields for late-night reviews.",
    preview: ["#fb7185", "#fdba74", "#1f2937"],
  },
  {
    id: "ocean-diff",
    name: "Ocean Diff",
    tagline: "Blue/green merge vibes — like a clean pull request.",
    preview: ["#38bdf8", "#34d399", "#0c4a6e"],
  },
  {
    id: "neon-commit",
    name: "Neon Commit",
    tagline: "Bold fluid orbs and a faint circuit grid.",
    preview: ["#2dd4bf", "#f472b6", "#111827"],
  },
];

export const DEFAULT_THEME: ThemeId = "harbor";
export const DEFAULT_MODE: ColorMode = "light";
export const THEME_STORAGE_KEY = "banter-theme";
export const MODE_STORAGE_KEY = "banter-color-mode";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function isColorMode(value: string | null | undefined): value is ColorMode {
  return value === "light" || value === "dark";
}
