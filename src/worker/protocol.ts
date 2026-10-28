// Nachrichten zwischen Oberfläche und Duell-Worker.
import type { OcgMessage, OcgResponse } from "ocgcore-wasm";
import type { DuelConfig } from "../engine/session";
import type { DuelView } from "../engine/view";

export type ToWorker =
  | { type: "start"; base: string; config: DuelConfig; responses?: OcgResponse[] }
  | { type: "respond"; response: OcgResponse }
  | { type: "undo"; n: number };

export type FromWorker =
  /** Neuer Zustand. `messages` = neue Kern-Nachrichten; bei `reset` der komplette Verlauf (Start/Rückgängig). */
  | { type: "state"; view: DuelView; messages: OcgMessage[]; reset: boolean; responses: OcgResponse[]; ms: number }
  /** Der Kern hat die letzte Antwort abgelehnt; die Entscheidung bleibt offen. */
  | { type: "rejected" }
  | { type: "error"; message: string };
