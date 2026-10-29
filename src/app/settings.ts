// Geräte-Einstellungen, die dauerhaft bleiben sollen (localStorage): Duell-Hintergrund, Seitenleiste, Ausrichtung.
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { applyOrientation, type OrientationSetting } from "../platform";

export const DUEL_BACKGROUNDS = [
  { id: "standard", name: "Schlicht" },
  { id: "matte", name: "Spielmatte" },
  { id: "nacht", name: "Nachtblau" },
  { id: "arkana", name: "Arkana" },
  { id: "holz", name: "Holztisch" },
] as const;
export type DuelBackground = (typeof DUEL_BACKGROUNDS)[number]["id"];

export const ORIENTATIONS: { id: OrientationSetting; name: string }[] = [
  { id: "auto", name: "Automatisch" },
  { id: "portrait", name: "Immer Hochformat" },
  { id: "landscape", name: "Immer Querformat" },
];

export interface OpponentPrefs {
  /** "sample:<id>" oder "deck:<id>" */
  deck: string;
  behavior: "set" | "passive";
  /** Karten, die der Gegner zu Beginn auf der Hand hat (Handtraps). */
  hand: number[];
  /** "ask": Du entscheidest, ob und wie der Gegner antwortet. "manual": Du spielst ihn komplett. */
  mode: "ask" | "pass" | "manual";
}

interface Settings {
  duelBg: DuelBackground;
  /** Duell im Querformat: Seitenleiste rechts (Rechtshänder) oder links. */
  sidebar: "right" | "left";
  orientation: OrientationSetting;
  /** Zuletzt gewählte Gegner-Einstellungen im Duell-Start (gerätebezogen, damit man sie nicht jedes Mal neu wählt). */
  opp: OpponentPrefs;
  /** Laufzeit (nicht gespeichert): false, wenn der Browser die gewählte Ausrichtung nicht sperren konnte. */
  orientationOk: boolean;
  setSettings(p: Partial<Omit<Settings, "setSettings">>): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({ duelBg: "matte", sidebar: "right", orientation: "auto", orientationOk: true,
      opp: { deck: "sample:klassik", behavior: "set", hand: [], mode: "pass" }, setSettings: (p) => set(p) }),
    {
      name: "settings",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ duelBg, sidebar, orientation, opp }) => ({ duelBg, sidebar, orientation, opp }),
      // Ältere Speicherstände ohne neue Felder: Standardwerte behalten.
      merge: (saved, current) => ({ ...current, ...(saved as object), opp: { ...current.opp, ...((saved as Partial<Settings>)?.opp ?? {}) } }),
    },
  ),
);

/** Gewählte Ausrichtung anwenden (beim Start und bei jeder Änderung). */
export function useOrientationLock() {
  const orientation = useSettings((s) => s.orientation);
  useEffect(() => {
    let alive = true;
    applyOrientation(orientation).then((ok) => alive && useSettings.getState().setSettings({ orientationOk: ok }));
    return () => { alive = false; };
  }, [orientation]);
}
