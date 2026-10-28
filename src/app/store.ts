// Zentraler App-Zustand. Alles, was beim Drehen erhalten bleiben muss (offene Dialoge, Suchtext,
// Import-Eingabe, aktiver Reiter), liegt hier – nicht im lokalen Zustand einzelner Komponenten.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CardSearch } from "../cards/search";
import type { ImportPreview } from "../deck/import";
import type { Deck, Section } from "../deck/types";
import type { GameData, Lang } from "../engine/data";
import { db, newId } from "./db";

export type Route = { screen: "decks" } | { screen: "deck"; id: string } | { screen: "system" } | { screen: "duel" };

export interface ImportState {
  /** Ziel: neues Deck oder ein bestehendes (ersetzen/ergänzen). */
  target: { kind: "new" } | { kind: "deck"; id: string; mode: "replace" | "add" };
  text: string;
  preview: ImportPreview | null;
  deckName: string;
}

interface UiState {
  route: Route;
  /** Deckbuilder im Hochformat: aktiver Reiter. */
  tab: "search" | "deck";
  query: string;
  /** Geöffnete Kartenansicht (Passcode). */
  detail: number | null;
  lang: Lang;
  import: ImportState | null;
  /** Scrollpositionen je Bereich, damit Drehen/Reiterwechsel sie nicht verliert. */
  scroll: Record<string, number>;
  /** Duell im Querformat: Seitenleiste rechts (Rechtshänder) oder links. */
  sidebar: "right" | "left";
  /** Offener Dialog „Duell starten“ für dieses Deck. */
  duelSetup: string | null;
}

interface AppState extends UiState {
  data: GameData | null;
  search: CardSearch | null;
  decks: Deck[];
  setData(data: GameData, search: CardSearch): void;
  set(p: Partial<UiState>): void;
  setScroll(key: string, top: number): void;
  loadDecks(): Promise<void>;
  saveDeck(deck: Deck): Promise<void>;
  createDeck(name: string, content?: Partial<Pick<Deck, Section>>): Promise<Deck>;
  copyDeck(id: string): Promise<Deck | undefined>;
  deleteDeck(id: string): Promise<void>;
  updateDeck(id: string, change: (d: Deck) => void): Promise<void>;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      route: { screen: "decks" },
      tab: "search",
      query: "",
      detail: null,
      lang: "de",
      import: null,
      scroll: {},
      sidebar: "right",
      duelSetup: null,
      data: null,
      search: null,
      decks: [],

      setData: (data, search) => set({ data, search }),
      set: (p) => set(p),
      setScroll: (key, top) => set((s) => ({ scroll: { ...s.scroll, [key]: top } })),

      async loadDecks() {
        const decks = await db.decks.orderBy("updatedAt").reverse().toArray();
        set({ decks });
      },
      async saveDeck(deck) {
        deck.updatedAt = Date.now();
        await db.decks.put(deck);
        set((s) => ({ decks: [deck, ...s.decks.filter((d) => d.id !== deck.id)] }));
      },
      async createDeck(name, content = {}) {
        const now = Date.now();
        const deck: Deck = { id: newId(), name, main: [], extra: [], side: [], ...content, createdAt: now, updatedAt: now };
        await get().saveDeck(deck);
        return deck;
      },
      async copyDeck(id) {
        const src = get().decks.find((d) => d.id === id);
        if (!src) return;
        return get().createDeck(`${src.name} (Kopie)`, { main: [...src.main], extra: [...src.extra], side: [...src.side] });
      },
      async deleteDeck(id) {
        await db.decks.delete(id);
        set((s) => ({ decks: s.decks.filter((d) => d.id !== id) }));
      },
      async updateDeck(id, change) {
        const d = get().decks.find((x) => x.id === id);
        if (!d) return;
        const copy: Deck = { ...d, main: [...d.main], extra: [...d.extra], side: [...d.side] };
        change(copy);
        await get().saveDeck(copy);
      },
    }),
    {
      name: "ui-state",
      // Nur Bedienzustand sichern; Decks liegen in IndexedDB, Kartendaten werden neu geladen.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s): UiState => ({ route: s.route, tab: s.tab, query: s.query, detail: s.detail, lang: s.lang, import: s.import, scroll: s.scroll, sidebar: s.sidebar, duelSetup: s.duelSetup }),
    },
  ),
);

export const useDeck = (id: string) => useApp((s) => s.decks.find((d) => d.id === id));
