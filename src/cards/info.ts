// Kartentypen, deutsche Typzeile und Deckzuordnung aus den Rohwerten von cards.cdb.
import type { CardRecord } from "../data/types";
import { attributeList, raceList } from "../engine/text";

export const T = {
  MONSTER: 0x1, SPELL: 0x2, TRAP: 0x4, NORMAL: 0x10, EFFECT: 0x20, FUSION: 0x40, RITUAL: 0x80,
  SPIRIT: 0x200, UNION: 0x400, GEMINI: 0x800, TUNER: 0x1000, SYNCHRO: 0x2000, TOKEN: 0x4000,
  QUICKPLAY: 0x10000, CONTINUOUS: 0x20000, EQUIP: 0x40000, FIELD: 0x80000, COUNTER: 0x100000,
  FLIP: 0x200000, TOON: 0x400000, XYZ: 0x800000, PENDULUM: 0x1000000, LINK: 0x4000000,
} as const;

export const isMonster = (c: CardRecord) => (c.type & T.MONSTER) !== 0;
export const isExtraDeckCard = (c: CardRecord) => (c.type & (T.FUSION | T.SYNCHRO | T.XYZ | T.LINK)) !== 0;
export const isToken = (c: CardRecord) => (c.type & T.TOKEN) !== 0;
/** Karte, die in ein Deck darf (keine Spielmarken, nur offiziell OCG/TCG). */
export const isDeckable = (c: CardRecord) => !isToken(c) && (c.ot & 3) !== 0;
/** Original-Passcode (Alt-Arts zählen als dieselbe Karte). */
export const baseId = (c: CardRecord) => (c.alias && c.alias !== c.id ? c.alias : c.id);

/** Rahmenart für Platzhalter/Farbe. */
export function frame(c: CardRecord): string {
  if (c.type & T.SPELL) return "spell";
  if (c.type & T.TRAP) return "trap";
  if (c.type & T.LINK) return "link";
  if (c.type & T.XYZ) return "xyz";
  if (c.type & T.SYNCHRO) return "synchro";
  if (c.type & T.FUSION) return "fusion";
  if (c.type & T.RITUAL) return "ritual";
  if (c.type & T.TOKEN) return "token";
  if (c.type & T.NORMAL) return "normal";
  return "effect";
}

/** Deutsche Typzeile, z. B. „FINSTERNIS · Stufe 3 · [Zombie/Effekt]“ oder „Schnellzauber“. */
export function typeLine(c: CardRecord): string {
  if (c.type & T.SPELL) {
    const sub = c.type & T.QUICKPLAY ? "Schnellzauber" : c.type & T.CONTINUOUS ? "Permanenter Zauber" : c.type & T.EQUIP ? "Ausrüstungszauber"
      : c.type & T.FIELD ? "Spielfeldzauber" : c.type & T.RITUAL ? "Ritualzauber" : "Normaler Zauber";
    return sub;
  }
  if (c.type & T.TRAP) return c.type & T.CONTINUOUS ? "Permanente Falle" : c.type & T.COUNTER ? "Konterfalle" : "Normale Falle";
  const parts: string[] = [];
  const attr = attributeList.find(([a]) => a === c.attribute)?.[1];
  if (attr) parts.push(attr);
  const lv = c.level & 0xff;
  parts.push(c.type & T.LINK ? `LINK-${lv}` : c.type & T.XYZ ? `Rang ${lv}` : `Stufe ${lv}`);
  if (c.type & T.PENDULUM) parts.push(`Pendelbereich ${(c.level >>> 24) & 0xff}`);
  const race = raceList.find(([r]) => r === BigInt(c.race))?.[1] ?? "?";
  const kinds: string[] = [race];
  const add = (flag: number, label: string) => { if (c.type & flag) kinds.push(label); };
  add(T.FUSION, "Fusion"); add(T.SYNCHRO, "Synchro"); add(T.XYZ, "Xyz"); add(T.LINK, "Link"); add(T.RITUAL, "Ritual");
  add(T.PENDULUM, "Pendel"); add(T.TUNER, "Empfänger"); add(T.FLIP, "Flipp"); add(T.SPIRIT, "Spirit"); add(T.UNION, "Union");
  add(T.GEMINI, "Zwilling"); add(T.TOON, "Toon");
  kinds.push(c.type & T.NORMAL ? "Normal" : c.type & T.TOKEN ? "Spielmarke" : "Effekt");
  parts.push(`[${kinds.join("/")}]`);
  return parts.join(" · ");
}

export function statLine(c: CardRecord): string | null {
  if (!isMonster(c)) return null;
  const v = (n: number) => (n < 0 ? "?" : String(n));
  return c.type & T.LINK ? `ATK ${v(c.atk)}` : `ATK ${v(c.atk)} / DEF ${v(c.def)}`;
}
