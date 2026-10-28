// Beispieldecks für den Gegner: alle Karten existieren, 40 Karten, Verhalten „setzt Karten“ funktioniert.
import createCore, { OcgLocation, type OcgCoreSync } from "ocgcore-wasm";
import { beforeAll, describe, expect, it } from "vitest";
import { isExtraDeckCard } from "../src/cards/info";
import { bundleExists, loadBundle } from "../src/data/node-bundle";
import type { GameData } from "../src/engine/data";
import { Driver } from "../src/engine/driver";
import { DuelSession } from "../src/engine/session";
import { C, mementoDeck } from "../src/fixtures/memento";
import { SAMPLE_DECKS } from "../src/fixtures/sampleDecks";

let core: OcgCoreSync;
let data: GameData;
beforeAll(async () => {
  if (!bundleExists()) return;
  core = await createCore({ sync: true });
  data = loadBundle();
});

describe.skipIf(!bundleExists())("Beispieldecks", () => {
  it.each(SAMPLE_DECKS.map((d) => [d.name, d] as const))("%s: 40 gültige Main-Deck-Karten", (_n, d) => {
    expect(d.main).toHaveLength(40);
    for (const code of d.main) {
      const c = data.cards.get(code);
      expect(c, `Passcode ${code}`).toBeTruthy();
      expect(isExtraDeckCard(c!)).toBe(false);
    }
  });

  it("Gegner „setzt Karten“: nach seinem Zug liegen Karten auf seinem Feld, die Hand läuft nicht über", () => {
    const opp = SAMPLE_DECKS.find((d) => d.id === "klassik")!;
    const s = DuelSession.start(core, data, {
      deck: mementoDeck, seed: 7, goFirst: true, hand: [C.Angwitch],
      opponent: { deck: { main: opp.main, extra: [] }, behavior: "set" },
    });
    new Driver(s).endPhase(); // Zug 1 sofort beenden → Gegner spielt Zug 2
    expect(s.turn).toBeGreaterThanOrEqual(3);
    const field = [...s.cards(1, OcgLocation.MZONE), ...s.cards(1, OcgLocation.SZONE)].filter(Boolean);
    expect(field.length).toBeGreaterThan(0);
    expect(s.cards(1, OcgLocation.GRAVE)).toHaveLength(0); // nichts wegen Handlimit abgeworfen
    s.destroy();
  });
});
