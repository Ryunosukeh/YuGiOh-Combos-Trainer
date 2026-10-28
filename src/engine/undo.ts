// „Rückgängig“ in ganzen Aktionen: Eine Aktion beginnt mit einer Wahl in der Main/Battle Phase
// (Beschwören, Aktivieren, Phasenwechsel …); alle folgenden Antworten (Zone, Ziel, Ja/Nein) gehören dazu.
import { OcgResponseType, type OcgResponse } from "ocgcore-wasm";

const isActionStart = (r: OcgResponse) => r.type === OcgResponseType.SELECT_IDLECMD || r.type === OcgResponseType.SELECT_BATTLECMD;

/** Anzahl Antworten, die zurückgenommen werden müssen, um die letzte Aktion komplett rückgängig zu machen. */
export function stepsToUndoAction(responses: OcgResponse[]): number {
  for (let i = responses.length - 1; i >= 0; i--) if (isActionStart(responses[i])) return responses.length - i;
  return responses.length; // vor der ersten Aktion: alles (z. B. Antworten im Zug des Gegners)
}
