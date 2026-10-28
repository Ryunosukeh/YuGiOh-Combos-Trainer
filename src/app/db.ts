// Lokale Datenhaltung im Browser (IndexedDB über Dexie).
import Dexie, { type Table } from "dexie";
import type { Deck } from "../deck/types";

class TrainerDb extends Dexie {
  decks!: Table<Deck, string>;
  /** Kartenbilder der Android-App (einmal heruntergeladen). Im Browser übernimmt das der Service Worker. */
  images!: Table<{ url: string; blob: Blob }, string>;
  constructor() {
    super("yugioh-combos-trainer");
    this.version(1).stores({ decks: "id, name, updatedAt" });
    this.version(2).stores({ decks: "id, name, updatedAt", images: "url" });
  }
}

export const db = new TrainerDb();

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `d${Date.now()}${Math.random().toString(36).slice(2)}`;
}
