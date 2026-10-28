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
 * Text zu einer Effekt-/Hinweisbeschreibung des Kerns.
 * `desc` = Kartencode * 16 + Index (aux.Stringid) oder eine Systemstring-Nummer.
 */
export function describeString(data: GameData, desc: bigint | number, lang: Lang = "de"): string {
  const d = BigInt(desc);
  if (d < 16000n) { // wie EDOPro: unter (1000 << 4) sind Systemstrings
    const n = String(d);
    return data.strings[lang].system[n] ?? data.strings.en.system[n] ?? `Text ${n}`;
  }
  const code = Number(d >> 4n);
  const idx = Number(d & 0xfn);
  const c = data.cards.get(code);
  const s = c?.strings[idx];
  if (s) return s;
  if (c) return `${cardName(data, code, lang)} (Effekt ${idx + 1})`;
  // Manche Hinweise enthalten direkt einen Kartencode (z. B. bei Zonen- oder Zahlenwahl).
  if (data.cards.has(Number(d))) return cardName(data, Number(d), lang);
  return `Text ${d}`;
}
