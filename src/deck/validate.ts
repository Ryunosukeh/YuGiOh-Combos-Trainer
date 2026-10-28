// Deckprüfung: Größen, max. 3 Exemplare, Banliste, richtige Deckabschnitte.
import type { LfList } from "../data/types";
import type { GameData } from "../engine/data";
import { cardName } from "../engine/data";
import { baseId, isExtraDeckCard } from "../cards/info";
import { LIMITS, SECTION_NAMES, type Section } from "./types";
import type { DeckList } from "../engine/session";

export interface DeckIssue {
  level: "error" | "warning";
  text: string;
  card?: number;
}

/** Aktuelle TCG-Banliste (erste Liste mit „TCG“ im Namen = neueste aus 0TCG.lflist.conf). */
export function defaultLfList(data: GameData): LfList | undefined {
  return data.lflists.find((l) => / TCG$/.test(l.name)) ?? data.lflists[0];
}

/** Erlaubte Anzahl laut Banliste (Alt-Arts zählen als Original). */
export function allowedCount(data: GameData, lf: LfList | undefined, code: number): number {
  if (!lf) return 3;
  const c = data.cards.get(code);
  const id = c ? baseId(c) : code;
  const n = lf.cards[String(id)] ?? lf.cards[String(code)];
  return n === undefined ? 3 : n;
}

export function validateDeck(deck: DeckList, data: GameData, lf: LfList | undefined): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const sections: [Section, number[]][] = [["main", deck.main], ["extra", deck.extra], ["side", deck.side ?? []]];
  for (const [s, list] of sections) {
    const [min, max] = LIMITS[s];
    if (list.length < min) issues.push({ level: "error", text: `${SECTION_NAMES[s]}: ${list.length} Karten, mindestens ${min}` });
    if (list.length > max) issues.push({ level: "error", text: `${SECTION_NAMES[s]}: ${list.length} Karten, höchstens ${max}` });
  }
  for (const code of deck.main) {
    const c = data.cards.get(code);
    if (c && isExtraDeckCard(c)) issues.push({ level: "error", text: `${cardName(data, code)} gehört ins Extra Deck`, card: code });
  }
  for (const code of deck.extra) {
    const c = data.cards.get(code);
    if (c && !isExtraDeckCard(c)) issues.push({ level: "error", text: `${cardName(data, code)} gehört nicht ins Extra Deck`, card: code });
  }
  // Anzahl über alle Abschnitte, gezählt nach Original-Passcode
  const counts = new Map<number, { n: number; code: number }>();
  for (const [, list] of sections)
    for (const code of list) {
      const c = data.cards.get(code);
      const id = c ? baseId(c) : code;
      const e = counts.get(id) ?? { n: 0, code };
      e.n++;
      counts.set(id, e);
    }
  for (const [id, { n, code }] of counts) {
    if (!data.cards.has(code)) { issues.push({ level: "error", text: `Unbekannte Karte ${code}`, card: code }); continue; }
    const allowed = allowedCount(data, lf, id);
    if (n > allowed) {
      const why = allowed === 0 ? "verboten" : allowed < 3 ? `limitiert auf ${allowed}` : `max. 3 Exemplare`;
      issues.push({ level: "error", text: `${cardName(data, id)}: ${n}× – ${why}${lf && allowed < 3 ? ` (${lf.name})` : ""}`, card: id });
    }
  }
  return issues;
}

/** In welchen Abschnitt eine Karte beim Hinzufügen gehört. */
export function sectionFor(data: GameData, code: number, wanted?: Section): Section {
  if (wanted === "side") return "side";
  const c = data.cards.get(code);
  return c && isExtraDeckCard(c) ? "extra" : "main";
}
