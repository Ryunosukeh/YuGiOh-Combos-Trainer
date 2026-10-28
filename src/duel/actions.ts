// Leitet aus der offenen Entscheidung ab, was auf dem Feld antippbar ist.
import { OcgMessageType, OcgResponseType, type OcgLocation, type OcgResponse } from "ocgcore-wasm";
import type { GameData } from "../engine/data";
import { buildPrompt, freeZones, type MenuOption } from "../engine/prompts";
import type { Decision } from "../engine/session";

export const keyOf = (c: { controller: number; location: number; sequence: number }) => `${c.controller}-${c.location}-${c.sequence}`;

export interface FieldActions {
  /** Main/Battle Phase: Aktionen je Karte. */
  byCard: Map<string, MenuOption[]>;
  /** Aktionen ohne Karte (Phasenwechsel usw.). */
  general: MenuOption[];
  /** SELECT_PLACE: antippbare Zonen. */
  zones: Map<string, OcgResponse>;
  /** Entscheidung wird über Feld/Hand getroffen (kein automatisches Auswahlfenster). */
  onField: boolean;
}

export function fieldActions(d: Decision | null, data: GameData): FieldActions {
  const empty: FieldActions = { byCard: new Map(), general: [], zones: new Map(), onField: false };
  if (!d) return empty;
  const t = d.msg.type;
  if (t === OcgMessageType.SELECT_IDLECMD || t === OcgMessageType.SELECT_BATTLECMD) {
    const p = buildPrompt(d.msg, { data, hint: d.hint });
    if (p?.kind !== "menu") return empty;
    const byCard = new Map<string, MenuOption[]>();
    const general: MenuOption[] = [];
    for (const o of p.options) {
      if (!o.card) { general.push(o); continue; }
      const k = keyOf(o.card);
      byCard.set(k, [...(byCard.get(k) ?? []), o]);
    }
    return { byCard, general, zones: new Map(), onField: true };
  }
  if (d.msg.type === OcgMessageType.SELECT_PLACE && d.msg.count <= 1) {
    const zones = new Map<string, OcgResponse>();
    for (const z of freeZones(d.msg.player, d.msg.field_mask))
      zones.set(`${z.player}-${z.location}-${z.sequence}`, { type: OcgResponseType.SELECT_PLACE, places: [{ player: z.player, location: z.location as OcgLocation, sequence: z.sequence }] });
    return { ...empty, zones };
  }
  return empty;
}
