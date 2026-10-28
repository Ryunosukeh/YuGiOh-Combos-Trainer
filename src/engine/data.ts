// Plattformneutraler Zugriff auf das Daten-Bundle (Karten, Skripte, Texte).
import type { CardRecord, LfList, Manifest, ScriptIndex, StringTable } from "../data/types";

/** Liefert Lua-Skripte synchron (der sync-Kern fragt sie während duelProcess ab). */
export interface ScriptSource {
  read(name: string): string | null;
}

/** Skripte aus einem entpackten Pack (eine Datei, Offset-Index). */
export class PackScriptSource implements ScriptSource {
  private readonly decoder = new TextDecoder();
  constructor(private readonly pack: Uint8Array, private readonly index: ScriptIndex) {}
  read(name: string): string | null {
    const entry = this.index[name];
    if (!entry) return null;
    return this.decoder.decode(this.pack.subarray(entry[0], entry[0] + entry[1]));
  }
  has(name: string) {
    return name in this.index;
  }
}

export interface GameData {
  manifest: Manifest;
  cards: Map<number, CardRecord>;
  scripts: ScriptSource;
  lflists: LfList[];
  strings: { en: StringTable; de: StringTable };
}

export type Lang = "de" | "en";

export function cardName(data: GameData, code: number, lang: Lang = "de"): string {
  const c = data.cards.get(code);
  if (!c) return `#${code}`;
  return (lang === "de" && c.nameDe) || c.name;
}

/**
 * Zerlegt eine Beschreibung des Kerns. Project Ignis kodiert `aux.Stringid(code, n)` als `code << 20 | n`
 * (utility.lua); Code 0 bedeutet Systemtext Nummer n.
 */
export function splitDescription(desc: bigint | number): { code: number; index: number } {
  const d = BigInt(desc);
  return { code: Number(d >> 20n), index: Number(d & 0xfffffn) };
}

/** Text zu einer Effekt-/Hinweisbeschreibung des Kerns (Systemtext, Kartentext str1..16 oder Kartenname). */
export function describeString(data: GameData, desc: bigint | number, lang: Lang = "de"): string {
  const { code, index } = splitDescription(desc);
  const system = (n: number) => data.strings[lang].system[String(n)] ?? data.strings.en.system[String(n)];
  if (code === 0) return system(index) ?? `Text ${index}`;
  const c = data.cards.get(code);
  if (c) return c.strings[index] || `${cardName(data, code, lang)} (Effekt ${index + 1})`;
  // Manche Hinweise enthalten direkt einen Kartencode (z. B. bei Zonen- oder Zahlenwahl).
  if (data.cards.has(Number(desc))) return cardName(data, Number(desc), lang);
  return `Text ${desc}`;
}
