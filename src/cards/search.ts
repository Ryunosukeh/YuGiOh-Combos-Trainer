// Kartensuche über deutsche und englische Namen – unscharf (Tippfehler, fehlende Bindestriche, Umlaute).
import { distance } from "fastest-levenshtein";
import MiniSearch from "minisearch";
import type { CardRecord } from "../data/types";
import type { GameData } from "../engine/data";
import { isDeckable } from "./info";

/** Vergleichsschlüssel: klein, Umlaute ausgeschrieben, Akzente weg, nur Buchstaben/Ziffern. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Wörter für den Suchindex (Bindestriche/Satzzeichen trennen). */
function tokenize(s: string): string[] {
  return s.split(/[\s\-–—_:,.!?'"„“()/&]+/).filter(Boolean);
}

/** Ähnlichkeit 0..1 zweier Schlüssel (1 = gleich). */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

/**
 * Ähnlichkeit der Eingabe zu einem Namen, auch wenn nur der Anfang getippt wurde
 * („Ash Blosom“ → „Ash Blossom & Joyous Spring“). Der Anfangsvergleich zählt etwas weniger.
 */
export function nameSimilarity(q: string, k: string): number {
  const full = similarity(q, k);
  if (k.length <= q.length) return full;
  const head = Math.max(similarity(q, k.slice(0, q.length)), similarity(q, k.slice(0, q.length + 1)));
  return Math.max(full, 0.85 * head);
}

export interface SearchHit {
  card: CardRecord;
  score: number;
  /** Welcher Name getroffen wurde. */
  matched: "de" | "en";
}

export class CardSearch {
  private readonly exact = new Map<string, number>();
  private readonly mini: MiniSearch<{ id: string; card: number; lang: "de" | "en"; name: string }>;
  readonly cards: CardRecord[];

  constructor(private readonly data: GameData) {
    this.cards = [...data.cards.values()].filter((c) => !c.alias && isDeckable(c));
    this.mini = new MiniSearch({
      fields: ["name"],
      storeFields: ["card", "lang"],
      tokenize,
      processTerm: (t) => nameKey(t) || null,
    });
    const docs: { id: string; card: number; lang: "de" | "en"; name: string }[] = [];
    for (const c of this.cards) {
      docs.push({ id: `${c.id}en`, card: c.id, lang: "en", name: c.name });
      this.exact.set(nameKey(c.name), c.id);
      if (c.nameDe) {
        docs.push({ id: `${c.id}de`, card: c.id, lang: "de", name: c.nameDe });
        // Deutscher Name gewinnt bei gleichem Schlüssel nicht gegen einen anderen englischen Treffer.
        if (!this.exact.has(nameKey(c.nameDe))) this.exact.set(nameKey(c.nameDe), c.id);
      }
    }
    this.mini.addAll(docs);
  }

  /** Exakter Treffer über den normalisierten Namen (DE oder EN). */
  exactMatch(name: string): CardRecord | undefined {
    const id = this.exact.get(nameKey(name));
    return id ? this.data.cards.get(id) : undefined;
  }

  /** Unscharfe Suche, beste Treffer zuerst. */
  search(query: string, limit = 50): SearchHit[] {
    const q = query.trim();
    const qk = nameKey(q);
    if (!qk) return [];
    const best = new Map<number, SearchHit>();
    const offer = (card: CardRecord, score: number, matched: "de" | "en") => {
      const prev = best.get(card.id);
      if (!prev || prev.score < score) best.set(card.id, { card, score, matched });
    };

    // 1) Wortsuche mit Präfix und Tippfehler-Toleranz
    const results = this.mini.search(q, { prefix: true, fuzzy: (term) => (term.length > 4 ? 0.25 : term.length > 2 ? 1 : 0), combineWith: "AND" });
    const fallback = results.length ? results : this.mini.search(q, { prefix: true, fuzzy: 0.3, combineWith: "OR" });
    for (const r of fallback.slice(0, 400)) {
      const card = this.data.cards.get(r.card as number)!;
      const name = r.lang === "de" ? card.nameDe! : card.name;
      offer(card, rank(qk, nameKey(name)), r.lang as "de" | "en");
    }
    // 2) Teilstring im Schlüssel (findet z. B. „tatsuno“ oder Namen ohne Leerzeichen)
    if (qk.length >= 3 && best.size < limit) {
      for (const c of this.cards) {
        if (nameKey(c.name).includes(qk)) offer(c, rank(qk, nameKey(c.name)), "en");
        if (c.nameDe && nameKey(c.nameDe).includes(qk)) offer(c, rank(qk, nameKey(c.nameDe)), "de");
      }
    }
    return [...best.values()].sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name)).slice(0, limit);
  }
}

/** Rangfolge: exakt > beginnt mit > enthält > ähnlich. */
function rank(q: string, k: string): number {
  if (k === q) return 1;
  if (k.startsWith(q)) return 0.9 + 0.09 * (q.length / k.length);
  if (k.includes(q)) return 0.8 + 0.09 * (q.length / k.length);
  return 0.79 * nameSimilarity(q, k);
}
