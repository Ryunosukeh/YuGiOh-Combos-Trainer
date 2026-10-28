// Automatische Antworten: leere Kettenfenster passen und der passive Dummy-Gegner.
// Alles hier muss deterministisch sein (gleiche Nachricht → gleiche Antwort), sonst bricht „Rückgängig“.
import { OcgMessageType, OcgResponseType, SelectBattleCMDAction, SelectIdleCMDAction, type OcgMessage, type OcgResponse } from "ocgcore-wasm";
import type { GameData } from "./data";
import { buildPrompt } from "./prompts";

/** Kleinste gültige Auswahl suchen (lexikografisch), z. B. für Pflicht-Auswahlen des Dummys. */
function smallestValid(n: number, min: number, max: number, validate: (s: number[]) => boolean): number[] | null {
  let budget = 20000;
  for (let size = Math.max(min, 0); size <= Math.min(max, n); size++) {
    const pick: number[] = [];
    const rec = (start: number): number[] | null => {
      if (--budget < 0) return null;
      if (pick.length === size) return validate(pick) ? [...pick] : null;
      for (let i = start; i < n; i++) {
        pick.push(i);
        const r = rec(i + 1);
        pick.pop();
        if (r) return r;
      }
      return null;
    };
    const r = rec(0);
    if (r) return r;
  }
  return null;
}

/**
 * Antwort des Dummys: aktiviert nie etwas, passt immer, greift nie an.
 * Erzwungene Auswahlen (z. B. Handlimit) werden mit der kleinsten gültigen Auswahl beantwortet.
 * Verhalten: "passive" tut nichts; "set" setzt pro Zug ein Monster verdeckt sowie Zauber/Fallen
 * (aktiviert nie etwas, greift nie an) – keine KI, eine feste Regel, damit das Feld Ziele hat und die Hand
 * nicht ständig überläuft.
 */
export type DummyBehavior = "passive" | "set";

export function dummyResponse(msg: OcgMessage, data: GameData, behavior: DummyBehavior = "passive"): OcgResponse {
  switch (msg.type) {
    case OcgMessageType.SELECT_IDLECMD:
      if (behavior === "set" && msg.monster_sets.length)
        return { type: OcgResponseType.SELECT_IDLECMD, action: SelectIdleCMDAction.SELECT_MONSTER_SET, index: 0 };
      if (behavior === "set" && msg.spell_sets.length)
        return { type: OcgResponseType.SELECT_IDLECMD, action: SelectIdleCMDAction.SELECT_SPELL_SET, index: 0 };
      return { type: OcgResponseType.SELECT_IDLECMD, action: msg.to_ep ? SelectIdleCMDAction.TO_EP : SelectIdleCMDAction.TO_BP, index: null };
    case OcgMessageType.SELECT_BATTLECMD:
      return { type: OcgResponseType.SELECT_BATTLECMD, action: msg.to_ep ? SelectBattleCMDAction.TO_EP : SelectBattleCMDAction.TO_M2, index: null };
    case OcgMessageType.SELECT_CHAIN:
      return { type: OcgResponseType.SELECT_CHAIN, index: msg.forced ? 0 : null };
    case OcgMessageType.SELECT_EFFECTYN:
      return { type: OcgResponseType.SELECT_EFFECTYN, yes: false };
    case OcgMessageType.SELECT_YESNO:
      return { type: OcgResponseType.SELECT_YESNO, yes: false };
    case OcgMessageType.SELECT_UNSELECT_CARD:
      return { type: OcgResponseType.SELECT_UNSELECT_CARD, index: msg.can_finish || msg.can_cancel || !msg.select_cards.length ? null : 0 };
  }
  const p = buildPrompt(msg, { data });
  if (!p) throw new Error(`Dummy kann Nachricht ${msg.type} nicht beantworten`);
  switch (p.kind) {
    case "menu":
      return p.options[0].response;
    case "select": {
      if (p.cancel) return p.cancel;
      const sel = smallestValid(p.items.length, p.min, p.max, p.validate);
      if (!sel) throw new Error("Dummy findet keine gültige Auswahl");
      return p.build(sel);
    }
    case "sort":
      return p.skip;
    case "counter": {
      let rest = p.total;
      return p.build(p.items.map((it) => { const n = Math.min(it.max, rest); rest -= n; return n; }));
    }
    case "announce-card":
      return p.build(p.candidates[0]);
  }
}

/** Leeres Antwortfenster (keine aktivierbaren Effekte) → automatisch passen. */
export function isEmptyChainWindow(msg: OcgMessage): boolean {
  return msg.type === OcgMessageType.SELECT_CHAIN && !msg.forced && msg.selects.length === 0;
}
