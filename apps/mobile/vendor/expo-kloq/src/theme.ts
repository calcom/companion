import { useColorScheme } from "react-native";
import type { EventColor } from "./model.ts";

/** kloq's five event hues (Tailwind's 500/100/900 steps), as plain colors React Native can draw. */
const EVENT_HUES: Record<
  EventColor,
  { solid: string; light: string; dark: string; inkLight: string; inkDark: string }
> = {
  blue: {
    solid: "#3b82f6",
    light: "#dbeafe",
    dark: "#1e3a8a",
    inkLight: "#1e3a8a",
    inkDark: "#dbeafe",
  },
  violet: {
    solid: "#8b5cf6",
    light: "#ede9fe",
    dark: "#4c1d95",
    inkLight: "#4c1d95",
    inkDark: "#ede9fe",
  },
  emerald: {
    solid: "#10b981",
    light: "#d1fae5",
    dark: "#064e3b",
    inkLight: "#064e3b",
    inkDark: "#d1fae5",
  },
  amber: {
    solid: "#f59e0b",
    light: "#fef3c7",
    dark: "#78350f",
    inkLight: "#78350f",
    inkDark: "#fef3c7",
  },
  rose: {
    solid: "#f43f5e",
    light: "#ffe4e6",
    dark: "#881337",
    inkLight: "#881337",
    inkDark: "#ffe4e6",
  },
};

export interface EventTint {
  /** the stripe and dot */
  solid: string;
  /** the chip's fill */
  fill: string;
  /** text on the fill */
  ink: string;
}

export interface Palette {
  dark: boolean;
  background: string;
  surface: string;
  text: string;
  muted: string;
  faint: string;
  rule: string;
  ruleStrong: string;
  today: string;
  todayInk: string;
  now: string;
  offHours: string;
  event: (color: EventColor) => EventTint;
}

const light: Omit<Palette, "event"> = {
  dark: false,
  background: "#ffffff",
  surface: "#f4f4f5",
  text: "#09090b",
  muted: "#71717a",
  faint: "#a1a1aa",
  rule: "#e4e4e7",
  ruleStrong: "#d4d4d8",
  today: "#ef4444",
  todayInk: "#ffffff",
  now: "#ef4444",
  offHours: "#fafafa",
};

const dark: Omit<Palette, "event"> = {
  dark: true,
  background: "#000000",
  surface: "#18181b",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#71717a",
  rule: "#27272a",
  ruleStrong: "#3f3f46",
  today: "#ef4444",
  todayInk: "#ffffff",
  now: "#f87171",
  offHours: "#0a0a0a",
};

export function paletteFor(scheme: "light" | "dark"): Palette {
  const base = scheme === "dark" ? dark : light;
  return {
    ...base,
    event: (color) => {
      const hue = EVENT_HUES[color] ?? EVENT_HUES.blue;
      return scheme === "dark"
        ? { solid: hue.solid, fill: hue.dark, ink: hue.inkDark }
        : { solid: hue.solid, fill: hue.light, ink: hue.inkLight };
    },
  };
}

export function usePalette(): Palette {
  return paletteFor(useColorScheme() === "dark" ? "dark" : "light");
}

/** The hue of a calendar's dot (lists, pickers). */
export const eventSolid = (color: EventColor): string =>
  (EVENT_HUES[color] ?? EVENT_HUES.blue).solid;
