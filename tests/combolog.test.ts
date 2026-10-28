// Combo-Protokoll und „Aktion rückgängig“ an der Abnahme-Combo.
import createCore, { OcgMessageType, type OcgCoreSync } from "ocgcore-wasm";
import { beforeAll, describe, expect, it } from "vitest";
import { bundleExists, loadBundle } from "../src/data/node-bundle";
import { comboLog, comboLogText } from "../src/engine/combolog";
import type { GameData } from "../src/engine/data";
import { Driver } from "../src/engine/driver";
import { DuelSession } from "../src/engine/session";
import { stepsToUndoAction } from "../src/engine/undo";
import { C, mementoDeck, playAcceptanceCombo } from "../src/fixtures/memento";

let core: OcgCoreSync;
let data: GameData;
beforeAll(async () => {
  if (!bundleExists()) return;
  core = await createCore({ sync: true });
  data = loadBundle();
});
const cfg = { deck: mementoDeck, seed: 1234, goFirst: true, hand: [C.Angwitch] };

describe.skipIf(!bundleExists())("Combo-Protokoll", () => {
  it("beschreibt die Abnahme-Combo Schritt für Schritt", () => {
    const s = DuelSession.start(core, data, cfg);
    playAcceptanceCombo(new Driver(s));
    const text = comboLogText(comboLog(s.history, data, s.me));
    const expected = [
      "Zug 1 (du)",
      "1. NS Mementotlanische Enghexe",
      "2. Mementotlanische Enghexe: sucht Mementotlanischer Tatsunootoshigo",
      "3. Mementotlanischer Tatsunootoshigo: beschwört sich als Spezialbeschwörung",
      "4. Mementotlanischer Tatsunootoshigo: zerstört sich, legt Mementotlanischer Stab, Mementotlanischer Goblin, Mementotlanischer Dachbodengeist in den Friedhof",
      "5. Mementotlanischer Dachbodengeist: beschwört sich als Spezialbeschwörung",
      "6. Mementotlanischer Dachbodengeist: holt Mementotlanischer Tatsunootoshigo auf die Hand",
      "7. Mementotlanische Enghexe: zerstört sich, SS Mementotlanischer Stab",
      "8. Mementotlanischer Stab: zerstört Mementotlanischer Dachbodengeist, sucht Mementotlanische Fusion",
      "9. Mementotlanische Fusion: Fusionsbeschwörung Mementomictlan Tecuhtlica - Schöpfungskönig (Material: Mementotlanische Enghexe, Mementotlanischer Tatsunootoshigo, Mementotlanischer Stab)",
      "10. Mementomictlan Tecuhtlica - Schöpfungskönig: legt Mementoal Tecuhtlica - Kombinierte Schöpfung, Mementotlanischer Akihiron, Mementomictlan Tecuhtlica - Schöpfungskönig in den Friedhof",
      "11. Mementomictlan Tecuhtlica - Schöpfungskönig: sucht Mementomictlan (Kosten: verbannt sich)",
      "12. Mementomictlan: wird aktiviert",
      "13. SS Mementoal Tecuhtlica - Kombinierte Schöpfung (Mementotlanischer Akihiron, Mementotlanischer Stab, Mementotlanischer Tatsunootoshigo, Mementotlanischer Dachbodengeist, Mementotlanischer Goblin ins Deck gemischt)",
      "— End Phase",
      "14. Mementomictlan: setzt Mementotlanische Fusion",
    ].join("\n");
    expect(text.startsWith(expected)).toBe(true);
    expect(text).not.toMatch(/Blauäugiger/); // Gegnerhand bleibt verdeckt
    s.destroy();
  });

  it("„Aktion zurück“ nimmt NS Enghexe inklusive Zone, Auslöser und Suche zurück", () => {
    let s = DuelSession.start(core, data, cfg);
    const d = new Driver(s);
    d.idle("summon", C.Angwitch);
    d.activate(C.Angwitch);
    d.pick(C.Tatsunootoshigo);
    expect(s.decision?.msg.type).toBe(OcgMessageType.SELECT_IDLECMD);
    const n = stepsToUndoAction(s.responses);
    expect(n).toBe(s.responses.length); // NS, Zone, Ja, Suche = alles bisher
    s = s.undo(n);
    expect(s.responses).toHaveLength(0);
    expect(s.cards(0, 0x02).map((c) => c!.code)).toEqual([C.Angwitch]);
    // Mitten in einer Aktion (Suche offen): ebenfalls zurück vor die Normalbeschwörung
    const d2 = new Driver(s);
    d2.idle("summon", C.Angwitch);
    d2.activate(C.Angwitch);
    expect(stepsToUndoAction(s.responses)).toBe(s.responses.length);
    s.destroy();
  });
});
