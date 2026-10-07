import { useColorScheme } from "react-native";

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  owned: string;
  wish: string;
  danger: string;
  overlay: string;
  skeleton: string;
}

const light: Palette = {
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF0F6",
  border: "#E3E6EF",
  text: "#12151F",
  textMuted: "#6B7285",
  primary: "#3B5BFF",
  onPrimary: "#FFFFFF",
  owned: "#14A44D",
  wish: "#EF3F6B",
  danger: "#D92D20",
  overlay: "rgba(8,10,20,0.85)",
  skeleton: "#E4E7F0",
};

const dark: Palette = {
  bg: "#0E1017",
  surface: "#171A24",
  surfaceAlt: "#222635",
  border: "#2A2F40",
  text: "#F2F4FA",
  textMuted: "#9AA1B5",
  primary: "#7C93FF",
  onPrimary: "#0E1017",
  owned: "#34C76F",
  wish: "#FF6B8E",
  danger: "#FF7A70",
  overlay: "rgba(0,0,0,0.92)",
  skeleton: "#262B3B",
};

export function useTheme(): { c: Palette; isDark: boolean } {
  const isDark = useColorScheme() === "dark";
  return { c: isDark ? dark : light, isDark };
}

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Pokémon TCG energy-type colors (used for type pills, energy cost dots and the detail hero tint). */
export const TYPE_COLORS: Record<string, string> = {
  Grass: "#4CAF50",
  Fire: "#F4511E",
  Water: "#2196F3",
  Lightning: "#FBC02D",
  Psychic: "#AB47BC",
  Fighting: "#A1572B",
  Darkness: "#37474F",
  Metal: "#78909C",
  Dragon: "#B8860B",
  Fairy: "#EC6FA8",
  Colorless: "#9E9E9E",
};

export const typeColor = (t?: string | null) => (t && TYPE_COLORS[t]) || "#9E9E9E";

export const TYPE_LABEL_KO: Record<string, string> = {
  Grass: "풀",
  Fire: "불꽃",
  Water: "물",
  Lightning: "전기",
  Psychic: "에스퍼",
  Fighting: "격투",
  Darkness: "악",
  Metal: "강철",
  Dragon: "드래곤",
  Fairy: "페어리",
  Colorless: "무색",
};

export const typeLabel = (t: string) => TYPE_LABEL_KO[t] ?? t;

export interface RarityStyle {
  tier: 0 | 1 | 2 | 3 | 4;
  color: string;
}

/** Collapse ~45 source rarity names into 5 visual tiers (common → secret) for badge styling. */
export function rarityStyle(rarity?: string | null): RarityStyle {
  const r = (rarity ?? "").toLowerCase();
  if (!r || r === "common") return { tier: 0, color: "#9AA1B5" };
  if (r === "uncommon" || r === "promo" || r === "classic collection") return { tier: 1, color: "#3FA7D6" };
  if (r === "rare" || r.includes("holo") || r === "double rare" || r.includes("break") || r.includes("legend"))
    return { tier: 2, color: "#7C5CFF" };
  if (
    r.includes("secret") ||
    r.includes("hyper") ||
    r.includes("rainbow") ||
    r.includes("special illustration") ||
    r.includes("mega")
  )
    return { tier: 4, color: "#F5B301" };
  return { tier: 3, color: "#E8590C" };
}
