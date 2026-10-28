import type { DeckList } from "../engine/session";

export type Section = "main" | "extra" | "side";

export interface Deck extends Required<DeckList> {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export const SECTION_NAMES: Record<Section, string> = { main: "Main Deck", extra: "Extra Deck", side: "Side Deck" };
export const LIMITS: Record<Section, [number, number]> = { main: [40, 60], extra: [0, 15], side: [0, 15] };
