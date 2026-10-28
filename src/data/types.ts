// Format des Daten-Bundles, das `npm run update-data` erzeugt und die App lädt.
import type { OcgCardData } from "ocgcore-wasm";

export const BUNDLE_FORMAT = 1;

/** Eine Karte aus cards.cdb, ergänzt um deutsche Texte (falls vorhanden). */
export interface CardRecord {
  id: number;
  alias: number;
  /** Bis zu 4 Archetyp-Codes (16 Bit) aus dem 64-Bit-Feld `setcode`. */
  setcodes: number[];
  type: number;
  atk: number;
  /** Bei Link-Monstern: Link-Marker (wie in cards.cdb). */
  def: number;
  /** Rohwert aus cards.cdb: Stufe/Rang/Link in Bits 0–7, Pendelbereiche in Bits 16–31. */
  level: number;
  race: number;
  attribute: number;
  /** Herkunft (1 = OCG, 2 = TCG, 3 = beides, …). */
  ot: number;
  category: number;
  name: string;
  desc: string;
  /** str1..str16 aus cards.cdb (Effektbeschreibungen für Auswahlmenüs), leere am Ende entfernt. */
  strings: string[];
  nameDe?: string;
  descDe?: string;
}

export interface CardsFile {
  format: number;
  cards: CardRecord[];
}

/** Index ins Skript-Pack: Dateiname → [Byte-Offset, Byte-Länge]. */
export type ScriptIndex = Record<string, [number, number]>;

/** Banliste: Passcode → erlaubte Anzahl (0, 1, 2). Nicht aufgeführte Karten: 3. */
export interface LfList {
  name: string;
  cards: Record<string, number>;
}

/** Texte aus strings.conf, z. B. system[500] = "Wähle eine Karte zum Tributieren". */
export interface StringTable {
  system: Record<string, string>;
  victory: Record<string, string>;
  counter: Record<string, string>;
  setname: Record<string, string>;
}

export interface Manifest {
  format: number;
  /** Eindeutige Version des Bundles (Datum + Kurz-Hashes der Quellen). */
  version: string;
  builtAt: string;
  coreVersion: string;
  sources: Record<string, { url: string; commit?: string; date?: string; note?: string }>;
  counts: { cards: number; cardsDe: number; scripts: number };
  files: Record<string, { bytes: number; sha256: string }>;
}

export const BUNDLE_FILES = {
  manifest: "manifest.json",
  cards: "cards.json.gz",
  scriptPack: "scripts.pack.gz",
  scriptIndex: "scripts.idx.json",
  lflists: "lflists.json",
  strings: "strings.json",
} as const;

export function toOcgCardData(c: CardRecord): OcgCardData {
  const isLink = (c.type & 0x4000000) !== 0;
  return {
    code: c.id,
    alias: c.alias,
    setcodes: c.setcodes,
    type: c.type,
    attack: c.atk,
    defense: isLink ? 0 : c.def,
    link_marker: isLink ? c.def : 0,
    level: c.level & 0xff,
    lscale: (c.level >>> 24) & 0xff,
    rscale: (c.level >>> 16) & 0xff,
    race: BigInt(c.race),
    attribute: c.attribute,
  };
}
