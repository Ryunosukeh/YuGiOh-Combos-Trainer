// Massen-Import: Textliste („3x Name“, „3 Name“, „Name x3“), .ydk-Inhalt oder ydke://-Link.
// Ergebnis ist eine Vorschau: sicher erkannt / unsicher (mit Vorschlägen) / nicht gefunden.
import type { GameData } from "../engine/data";
import { cardName } from "../engine/data";
import { isExtraDeckCard } from "../cards/info";
import { nameKey, nameSimilarity, type CardSearch } from "../cards/search";
import type { DeckList } from "../engine/session";
import type { Section } from "./types";
import { parseYdk } from "./ydk";
import { isYdke, parseYdke } from "./ydke";

export type ImportStatus = "sicher" | "unsicher" | "fehlt";

export interface ImportCandidate {
  id: number;
  name: string;
  score: number;
}

export interface ImportItem {
  /** Zeilennummer (1-basiert) im eingefügten Text. */
  line: number;
  raw: string;
  name: string;
  count: number;
  /** Abschnitt laut Überschrift; Extra-Deck-Monster landen unabhängig davon im Extra Deck. */
  header: Section;
  status: ImportStatus;
  candidates: ImportCandidate[];
  /** Gewählte Karte (bei „sicher“ gesetzt, bei „unsicher“ der beste Vorschlag vorausgewählt). */
  chosen: number | null;
}

export interface ImportPreview {
  format: "text" | "ydk" | "ydke";
  items: ImportItem[];
  /** Ignorierte Zeilen, die weder Überschrift noch Karte waren (zur Info). */
  ignored: string[];
}

const HEADER = /^(?:#|!)?\s*(main|haupt|extra|side|neben)[\s-]*(?:deck)?\s*:?\s*(?:\(\s*\d+\s*\))?\s*:?$/i;
const CATEGORY = /^(?:monster|monsters|zauber|zauberkarten|spells?|fallen|fallenkarten|traps?|extra[- ]?deck[- ]?monster)\s*:?\s*(?:\(\s*\d+\s*\))?\s*:?$/i;

/** Eine Zeile in Anzahl und Namen zerlegen. */
export function parseLine(raw: string): { count: number; name: string } | null {
  let s = raw.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim(); // Aufzählungszeichen
  if (!s) return null;
  let m = /^(\d{1,2})\s*[x×*]?\s+(.+)$/i.exec(s) ?? /^[x×]\s*(\d{1,2})\s+(.+)$/i.exec(s);
  if (m) return { count: Number(m[1]), name: m[2].trim() };
  m = /^(.+?)\s*(?:[x×*]\s*(\d{1,2})|(\d{1,2})\s*[x×])$/i.exec(s);
  if (m) return { count: Number(m[2] ?? m[3]), name: m[1].trim() };
  m = /^(\d{1,2})[x×](.+)$/i.exec(s); // „3xName“
  if (m) return { count: Number(m[1]), name: m[2].trim() };
  return { count: 1, name: s };
}

function sectionOf(word: string): Section {
  const w = word.toLowerCase();
  return w === "extra" ? "extra" : w === "side" || w === "neben" ? "side" : "main";
}

/** Vorschläge für einen Namen, beste zuerst (Ähnlichkeit über DE- und EN-Namen). */
function suggest(search: CardSearch, data: GameData, name: string): ImportCandidate[] {
  const key = nameKey(name);
  return search
    .search(name, 12)
    .map((h) => {
      const sim = Math.max(nameSimilarity(key, nameKey(h.card.name)), h.card.nameDe ? nameSimilarity(key, nameKey(h.card.nameDe)) : 0);
      return { id: h.card.id, name: cardName(data, h.card.id), score: Math.max(sim, h.score * 0.95) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function previewImport(text: string, data: GameData, search: CardSearch): ImportPreview {
  if (isYdke(text)) return fromCodes(parseYdke(text), "ydke", data);
  if (/^\s*#main\b/m.test(text) && /^\s*\d{3,9}\s*$/m.test(text)) return fromCodes(parseYdk(text), "ydk", data);

  const items: ImportItem[] = [];
  const ignored: string[] = [];
  let header: Section = "main";
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith("//") || /^#(?!main|extra)/i.test(raw)) return;
    const h = HEADER.exec(raw);
    if (h) { header = sectionOf(h[1]); return; }
    if (CATEGORY.test(raw)) return;
    const parsed = parseLine(raw);
    if (!parsed || parsed.count < 1) { ignored.push(raw); return; }

    // Ganze Zeile zuerst prüfen: Namen wie „7 Colored Fish“ beginnen selbst mit einer Zahl.
    const whole = parsed.count > 1 && !/[x×]/i.test(raw) ? search.exactMatch(raw.replace(/^\s*[-*•·]\s+/, "")) : undefined;
    if (whole) { parsed.count = 1; parsed.name = raw; }
    const exact = whole ?? search.exactMatch(parsed.name);
    if (exact) {
      items.push({ line: i + 1, raw, ...parsed, header, status: "sicher", candidates: [{ id: exact.id, name: cardName(data, exact.id), score: 1 }], chosen: exact.id });
      return;
    }
    const candidates = suggest(search, data, parsed.name);
    const best = candidates[0];
    if (!best || best.score < 0.45) {
      items.push({ line: i + 1, raw, ...parsed, header, status: "fehlt", candidates, chosen: null });
      return;
    }
    items.push({ line: i + 1, raw, ...parsed, header, status: "unsicher", candidates, chosen: best.id });
  });
  return { format: "text", items, ignored };
}

function fromCodes(deck: Required<DeckList>, format: "ydk" | "ydke", data: GameData): ImportPreview {
  const items: ImportItem[] = [];
  let line = 0;
  for (const [section, list] of [["main", deck.main], ["extra", deck.extra], ["side", deck.side]] as [Section, number[]][]) {
    const counts = new Map<number, number>();
    for (const c of list) counts.set(c, (counts.get(c) ?? 0) + 1);
    for (const [code, count] of counts) {
      const known = data.cards.has(code);
      items.push({
        line: ++line, raw: String(code), name: known ? cardName(data, code) : `#${code}`, count, header: section,
        status: known ? "sicher" : "fehlt", candidates: known ? [{ id: code, name: cardName(data, code), score: 1 }] : [], chosen: known ? code : null,
      });
    }
  }
  return { format, items, ignored: [] };
}

/** Deck aus der (vom Nutzer bestätigten) Vorschau bauen. Nicht zugeordnete Einträge werden ausgelassen. */
export function buildDeck(items: ImportItem[], data: GameData): Required<DeckList> {
  const deck: Required<DeckList> = { main: [], extra: [], side: [] };
  for (const it of items) {
    if (it.chosen === null) continue;
    const card = data.cards.get(it.chosen);
    const target: Section = it.header === "side" ? "side" : card && isExtraDeckCard(card) ? "extra" : "main";
    for (let i = 0; i < it.count; i++) deck[target].push(it.chosen);
  }
  return deck;
}
