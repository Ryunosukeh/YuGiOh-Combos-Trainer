// Geräte-Einstellungen, die dauerhaft bleiben sollen (localStorage): Duell-Hintergrund, Seitenleiste.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const DUEL_BACKGROUNDS = [
  { id: "standard", name: "Schlicht" },
  { id: "matte", name: "Spielmatte" },
  { id: "nacht", name: "Nachtblau" },
  { id: "arkana", name: "Arkana" },
  { id: "holz", name: "Holztisch" },
] as const;
export type DuelBackground = (typeof DUEL_BACKGROUNDS)[number]["id"];

interface Settings {
  duelBg: DuelBackground;
  /** Duell im Querformat: Seitenleiste rechts (Rechtshänder) oder links. */
  sidebar: "right" | "left";
  setSettings(p: Partial<Omit<Settings, "setSettings">>): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({ duelBg: "matte", sidebar: "right", setSettings: (p) => set(p) }),
    { name: "settings", storage: createJSONStorage(() => localStorage), partialize: ({ duelBg, sidebar }) => ({ duelBg, sidebar }) },
  ),
);
