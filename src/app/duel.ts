// Duell-Zustand der Oberfläche. Der Regelkern läuft im Worker; hier liegen Ansicht, Verlauf und UI-Zustand.
// Konfiguration + Antworten werden in sessionStorage gesichert → nach Neuladen wird das Duell neu abgespielt.
import type { OcgMessage, OcgResponse } from "ocgcore-wasm";
import { create } from "zustand";
import type { DuelConfig } from "../engine/session";
import type { DuelView } from "../engine/view";
import type { FromWorker, ToWorker } from "../worker/protocol";
import { stepsToUndoAction } from "../engine/undo";

const SAVE_KEY = "duel-save";
// JSON kennt kein BigInt (kommt in Antworten wie ANNOUNCE_RACE vor).
const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? { $big: v.toString() } : v);
const reviver = (_k: string, v: unknown) => (v && typeof v === "object" && "$big" in v ? BigInt((v as { $big: string }).$big) : v);

interface Saved { config: DuelConfig; responses: OcgResponse[]; deckId?: string }

export interface PileRef { player: 0 | 1; location: number }

interface DuelState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  view: DuelView | null;
  log: OcgMessage[];
  config: DuelConfig | null;
  deckId?: string;
  busy: boolean;
  /** Letzte Antwort wurde vom Kern abgelehnt. */
  rejected: boolean;
  lastMs: number;
  /** Bisherige Nutzerentscheidungen (für „Aktion zurück“). */
  responses: OcgResponse[];
  /** Auswahlfenster eingeklappt („Feld ansehen“). */
  minimized: boolean;
  /** Geöffneter Stapel (Friedhof, Verbannt, Extra Deck). */
  pile: PileRef | null;
  /** Karte, deren Aktionen (Main/Battle Phase) gerade angezeigt werden: Schlüssel controller-location-sequence. */
  cardMenu: string | null;
  start(config: DuelConfig, deckId?: string, responses?: OcgResponse[]): void;
  respond(r: OcgResponse): void;
  undo(n?: number): void;
  /** Letzte ganze Aktion zurücknehmen (inkl. Zonenwahl, Zielen, Ja/Nein). */
  undoAction(): void;
  restart(newSeed?: number): void;
  leave(): void;
  restore(): boolean;
  setUi(p: Partial<Pick<DuelState, "minimized" | "pile" | "cardMenu">>): void;
}

let worker: Worker | null = null;
function getWorker(onMessage: (m: FromWorker) => void): Worker {
  if (!worker) {
    worker = new Worker(new URL("../worker/duel.worker.ts", import.meta.url), { type: "module" });
  }
  worker.onmessage = (e: MessageEvent<FromWorker>) => onMessage(e.data);
  return worker;
}

export const useDuel = create<DuelState>()((set, get) => {
  const send = (m: ToWorker) => getWorker(onMessage).postMessage(m);
  const save = (responses: OcgResponse[]) => {
    const { config, deckId } = get();
    if (!config) return;
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ config, responses, deckId } satisfies Saved, replacer)); } catch { /* voll/privat: egal */ }
  };
  function onMessage(m: FromWorker) {
    switch (m.type) {
      case "state":
        save(m.responses);
        set((s) => ({
          status: "ready", view: m.view, busy: false, rejected: false, lastMs: m.ms, cardMenu: null, minimized: false, responses: m.responses,
          log: m.reset ? m.messages : [...s.log, ...m.messages],
        }));
        break;
      case "rejected":
        set({ busy: false, rejected: true });
        break;
      case "error":
        set({ busy: false, status: "error", error: m.message });
        break;
    }
  }
  const base = () => new URL("data/", document.baseURI).toString();

  return {
    status: "idle", error: null, view: null, log: [], config: null, busy: false, rejected: false, lastMs: 0, responses: [],
    minimized: false, pile: null, cardMenu: null,

    start(config, deckId, responses = []) {
      set({ status: "loading", error: null, view: null, log: [], config, deckId, busy: true, pile: null, cardMenu: null, minimized: false });
      send({ type: "start", base: base(), config, responses });
    },
    respond(r) {
      if (get().busy) return;
      set({ busy: true, rejected: false, cardMenu: null });
      send({ type: "respond", response: r });
    },
    undo(n = 1) {
      if (get().busy || !get().view?.steps) return;
      set({ busy: true, cardMenu: null, pile: null });
      send({ type: "undo", n });
    },
    undoAction() {
      const n = stepsToUndoAction(get().responses);
      if (n) get().undo(n);
    },
    restart(newSeed) {
      const c = get().config;
      if (c) get().start(newSeed === undefined ? c : { ...c, seed: newSeed }, get().deckId);
    },
    leave() {
      sessionStorage.removeItem(SAVE_KEY);
      set({ status: "idle", view: null, log: [], config: null, pile: null, cardMenu: null });
    },
    restore() {
      try {
        const raw = sessionStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const s = JSON.parse(raw, reviver) as Saved;
        get().start(s.config, s.deckId, s.responses);
        return true;
      } catch {
        return false;
      }
    },
    setUi: (p) => set(p),
  };
});
