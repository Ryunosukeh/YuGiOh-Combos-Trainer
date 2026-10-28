// Deck-Logik: Massen-Import (DE/EN), Validierung, .ydk/ydke.
import { beforeAll, describe, expect, it } from "vitest";
import { CardSearch, nameKey } from "../src/cards/search";
import { typeLine } from "../src/cards/info";
import { bundleExists, loadBundle } from "../src/data/node-bundle";
import { buildDeck, parseLine, previewImport } from "../src/deck/import";
import { defaultLfList, validateDeck } from "../src/deck/validate";
import { parseYdk, toYdk } from "../src/deck/ydk";
import { parseYdke, toYdke } from "../src/deck/ydke";
import type { GameData } from "../src/engine/data";
import { C, mementoDeck } from "../src/fixtures/memento";
import { ACCEPTANCE_LIST } from "./acceptance-list";

const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
const hasData = bundleExists();
let data: GameData;
let search: CardSearch;
beforeAll(() => {
  if (!hasData) return;
  data = loadBundle();
  search = new CardSearch(data);
});

describe("Zeilen-Parser", () => {
  it.each([
    ["3x Mementotlanische Enghexe", 3, "Mementotlanische Enghexe"],
    ["3 Mementotlanische Enghexe", 3, "Mementotlanische Enghexe"],
    ["Mementotlanische Enghexe x3", 3, "Mementotlanische Enghexe"],
    ["Mementotlanische Enghexe 3x", 3, "Mementotlanische Enghexe"],
    ["3× Ash Blossom & Joyous Spring", 3, "Ash Blossom & Joyous Spring"],
    ["- 2x Droll & Lock Bird", 2, "Droll & Lock Bird"],
    ["Mementomictlan", 1, "Mementomictlan"],
    ["1x I:P Maskerena", 1, "I:P Maskerena"],
  ])("%s", (line, count, name) => {
    expect(parseLine(line)).toEqual({ count, name });
  });
});

describe.skipIf(!hasData)("Massen-Import", () => {
  it("erkennt die komplette Abnahme-Liste sicher und ergibt exakt das Testdeck", () => {
    const p = previewImport(ACCEPTANCE_LIST, data, search);
    const notSure = p.items.filter((i) => i.status !== "sicher").map((i) => `${i.raw} → ${i.status}`);
    expect(notSure).toEqual([]);
    const deck = buildDeck(p.items, data);
    expect(sorted(deck.main)).toEqual(sorted(mementoDeck.main));
    expect(sorted(deck.extra)).toEqual(sorted(mementoDeck.extra));
    expect(deck.main).toHaveLength(42);
    expect(deck.extra).toHaveLength(15);
  });

  it("ordnet Extra-Deck-Monster ohne Überschrift automatisch zu", () => {
    const p = previewImport("3 Mementomictlan Tecuhtlica - Schöpfungskönig\n2 Ash Blossom & Joyous Spring", data, search);
    const deck = buildDeck(p.items, data);
    expect(deck.extra).toEqual([C.CreationKing, C.CreationKing, C.CreationKing]);
    expect(deck.main).toEqual([C.AshBlossom, C.AshBlossom]);
  });

  it("englischer Name aus dem Hinweis der Aufgabe (Goblin Biker Dugg Charger) wird erkannt", () => {
    const p = previewImport("1 Goblin Biker Dugg Charger", data, search);
    expect(p.items[0]).toMatchObject({ status: "sicher", chosen: C.DuggCharger });
  });

  it.each([
    ["Mementotlanische Enghex", C.Angwitch], // Tippfehler
    ["Mementotlanischer Tatsunotoshigo", C.Tatsunootoshigo],
    ["Goblin Biker Dugg Angreifer", C.DuggCharger], // Bindestrich fehlt → Schlüssel gleich → sicher
    ["Mementomictlan Tecuhtlica Schoepfungskoenig", C.CreationKing],
    ["Ash Blosom", C.AshBlossom],
    ["mystischer raumtaifun", C.MST],
  ])("unscharf: „%s“ → richtiger Vorschlag", (name, id) => {
    const it = previewImport(`1x ${name}`, data, search).items[0];
    expect(it.status === "sicher" || it.status === "unsicher").toBe(true);
    expect(it.chosen).toBe(id);
  });

  it("unbekanntes → nicht gefunden", () => {
    expect(previewImport("2x Qwertzuiop Blablub Xyzzy", data, search).items[0].status).toBe("fehlt");
  });

  it("Seite-Deck-Überschrift und Kategorie-Überschriften", () => {
    const p = previewImport("Monster (3)\n3 Mementotlanische Enghexe\nSide Deck:\n2 Droll & Lock Bird", data, search);
    const deck = buildDeck(p.items, data);
    expect(deck.main).toHaveLength(3);
    expect(deck.side).toEqual([C.DrollLockBird, C.DrollLockBird]);
  });

  it(".ydk und ydke:// hin und zurück", () => {
    const deck = { ...mementoDeck, side: [C.DrollLockBird] };
    expect(parseYdk(toYdk(deck))).toEqual(deck);
    const link = toYdke(deck);
    expect(link.startsWith("ydke://")).toBe(true);
    expect(parseYdke(link)).toEqual(deck);
    const p = previewImport(link, data, search);
    expect(p.format).toBe("ydke");
    expect(sorted(buildDeck(p.items, data).main)).toEqual(sorted(deck.main));
  });
});

describe.skipIf(!hasData)("Suche und Prüfung", () => {
  it("findet über deutsche und englische Namen und Wortteile", () => {
    expect(search.search("Enghexe")[0].card.id).toBe(C.Angwitch);
    expect(search.search("angwitch")[0].card.id).toBe(C.Angwitch);
    expect(search.search("tatsuno").slice(0, 3).map((h) => h.card.id)).toContain(C.Tatsunootoshigo); // „Tatsunoko“ ist zu Recht vorn
    expect(search.search("Aschenblüte")[0].card.id).toBe(C.AshBlossom);
    expect(search.search("raum taifun").map((h) => h.card.id)).toContain(C.MST);
    expect(nameKey("Schöpfungskönig")).toBe("schoepfungskoenig");
  });

  it("deutsche Typzeile", () => {
    expect(typeLine(data.cards.get(C.Angwitch)!)).toBe("FINSTERNIS · Stufe 3 · [Hexer/Effekt]");
    expect(typeLine(data.cards.get(C.MementoFusion)!)).toBe("Schnellzauber");
  });

  it("Testdeck ist laut aktueller TCG-Liste gültig, Verstöße werden gemeldet", () => {
    const lf = defaultLfList(data);
    expect(lf?.name).toMatch(/TCG$/);
    expect(validateDeck(mementoDeck, data, lf)).toEqual([]);
    const bad = validateDeck({ main: [...mementoDeck.main, C.AshBlossom, C.AshBlossom], extra: [...mementoDeck.extra, C.Angwitch], side: [] }, data, lf);
    const texts = bad.map((b) => b.text).join("\n");
    expect(texts).toMatch(/4×/);
    expect(texts).toMatch(/Extra Deck/);
    expect(texts).toMatch(/höchstens 15/);
  });
});
