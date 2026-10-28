// Engine-Tests gegen den echten Kern und die echten Project-Ignis-Skripte.
// Benötigen das Datenpaket (npm run update-data); ohne Paket werden sie übersprungen.
import { OcgLocation, OcgMessageType, OcgPosition } from "ocgcore-wasm";
import createCore, { type OcgCoreSync } from "ocgcore-wasm";
import { beforeAll, describe, expect, it } from "vitest";
import { bundleExists, loadBundle } from "../src/data/node-bundle";
import type { GameData } from "../src/engine/data";
import { DuelSession, type DuelConfig } from "../src/engine/session";
import { Driver } from "../src/engine/driver";
import { C, mementoDeck, playAcceptanceCombo } from "../src/fixtures/memento";

const hasData = bundleExists();
let core: OcgCoreSync;
let data: GameData;

beforeAll(async () => {
  if (!hasData) return;
  core = await createCore({ sync: true });
  data = loadBundle();
});

const testhand: DuelConfig = { deck: mementoDeck, seed: 1234, goFirst: true, hand: [C.Angwitch] };

const codes = (s: DuelSession, p: 0 | 1, loc: OcgLocation) => s.cards(p, loc).filter(Boolean).map((c) => c!.code);

describe.skipIf(!hasData)("Engine", () => {
  it("spielt die Abnahme-Combo vollständig durch", () => {
    const s = DuelSession.start(core, data, testhand);
    playAcceptanceCombo(new Driver(s));

    expect(s.missingScripts.size === 0 || [...s.missingScripts].every((n) => /^c(0|89631139)\.lua$/.test(n))).toBe(true);
    // Zug des Gegners hat begonnen (Dummy) oder wir stehen wieder bei uns – auf jeden Fall:
    expect(codes(s, 0, OcgLocation.MZONE).sort()).toEqual([C.CreationKing, C.CombinedCreation].sort());
    expect(codes(s, 0, OcgLocation.REMOVED)).toContain(C.CreationKing);
    const st = s.cards(0, OcgLocation.SZONE).filter(Boolean);
    expect(st.find((c) => c!.code === C.Mictlan)).toBeTruthy();
    const fusion = st.find((c) => c!.code === C.MementoFusion);
    expect((fusion?.position ?? 0) & OcgPosition.FACEUP).toBe(0); // gesetzt = verdeckt
    s.destroy();
  });

  it("ist deterministisch: Neuabspielen ergibt denselben Nachrichtenverlauf", () => {
    const a = DuelSession.start(core, data, testhand);
    playAcceptanceCombo(new Driver(a));
    const b = DuelSession.start(core, data, testhand, a.responses);
    const strip = (s: DuelSession) => JSON.stringify(s.history, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(strip(b)).toBe(strip(a));
    a.destroy();
    b.destroy();
  });

  it("Rückgängig nimmt genau eine Entscheidung zurück", () => {
    let s = DuelSession.start(core, data, testhand);
    const d = new Driver(s);
    d.idle("summon", C.Angwitch);
    d.activate(C.Angwitch);
    const before = s.decision!.msg.type;
    expect(before).toBe(OcgMessageType.SELECT_CARD);
    d.pick(C.Tatsunootoshigo);
    expect(codes(s, 0, OcgLocation.HAND)).toContain(C.Tatsunootoshigo);
    s = s.undo();
    expect(s.decision!.msg.type).toBe(OcgMessageType.SELECT_CARD);
    expect(codes(s, 0, OcgLocation.HAND)).not.toContain(C.Tatsunootoshigo);
    // anderen Weg nehmen: Dachbodengeist statt Tatsu suchen
    new Driver(s).pick(C.Ghattic);
    expect(codes(s, 0, OcgLocation.HAND)).toContain(C.Ghattic);
    s.destroy();
  });

  it("lehnt ungültige Antworten ab, ohne das Duell zu verändern", () => {
    const s = DuelSession.start(core, data, testhand);
    const d = new Driver(s);
    d.idle("summon", C.Angwitch);
    d.activate(C.Angwitch);
    const n = s.responses.length;
    const ok = s.respond({ type: 5 /* SELECT_CARD */, indicies: [0, 1, 2] } as never); // max ist 1
    expect(ok).toBe(false);
    expect(s.responses.length).toBe(n);
    d.pick(C.Tatsunootoshigo);
    expect(codes(s, 0, OcgLocation.HAND)).toContain(C.Tatsunootoshigo);
    s.destroy();
  });

  it("zufällige Starthand ist per Seed wiederholbar, anderer Seed → andere Hand", () => {
    const cfg: DuelConfig = { deck: mementoDeck, seed: 99, goFirst: false };
    const a = DuelSession.start(core, data, cfg);
    const b = DuelSession.start(core, data, cfg);
    expect(a.me).toBe(1);
    expect(codes(a, 1, OcgLocation.HAND)).toEqual(codes(b, 1, OcgLocation.HAND));
    expect(codes(a, 1, OcgLocation.HAND)).toHaveLength(5); // erste Entscheidung fällt noch im Zug des Gegners
    const c = DuelSession.start(core, data, { ...cfg, seed: 100 });
    expect(codes(c, 1, OcgLocation.HAND)).not.toEqual(codes(a, 1, OcgLocation.HAND));
    [a, b, c].forEach((s) => s.destroy());
  });

  it("Gegner-Modus „fragen“: Ash Blossom des Dummys wird dem Nutzer angeboten", () => {
    const s = DuelSession.start(core, data, { ...testhand, opponent: { hand: [C.AshBlossom], mode: "ask" } });
    const d = new Driver(s);
    d.idle("summon", C.Angwitch);
    d.activate(C.Angwitch);
    // Jetzt darf der Gegner antworten: Ash Blossom steht zur Wahl.
    expect(s.decision?.forOpponent).toBe(true);
    d.activate(C.AshBlossom);
    expect(codes(s, 1, OcgLocation.GRAVE)).toContain(C.AshBlossom);
    // Suche wurde annulliert: Wir sind zurück in der Main Phase, ohne Suche.
    expect(s.decision?.msg.type).toBe(OcgMessageType.SELECT_IDLECMD);
    expect(codes(s, 0, OcgLocation.HAND)).not.toContain(C.Tatsunootoshigo);
    s.destroy();
  });

  it("Karten sortieren (SORT_CARD) – deckt den Patch für ocgcore-wasm 0.1.6 ab", () => {
    // Card Advance: bis zu 5 oberste Karten ansehen und in beliebiger Reihenfolge zurücklegen.
    const CARD_ADVANCE = 52112003;
    const vanillas = [89631139, 46986414, 74677422, 6368038, 38033121, 87796900, 70781052, 15025844];
    const main = [...Array.from({ length: 40 }, (_, i) => vanillas[i % 8]), CARD_ADVANCE];
    const s = DuelSession.start(core, data, { deck: { main, extra: [] }, seed: 5, goFirst: true, hand: [CARD_ADVANCE] });
    const d = new Driver(s);
    d.idle("activate", CARD_ADVANCE);
    d.skipPlacement();
    const num = d.prompt;
    if (num.kind !== "menu") throw new Error("Zahlenwahl erwartet");
    s.respond(num.options.find((o) => o.label === "5")!.response);
    const p = d.prompt;
    if (p.kind !== "sort") throw new Error(`Sortierung erwartet, bekam ${p.kind}`);
    const before = p.items.map((i) => i.card!.code);
    expect(s.respond(p.build([4, 3, 2, 1, 0]))).toBe(true);
    const top = codes(s, 0, OcgLocation.DECK).slice(-5).reverse();
    expect(top).toEqual([...before].reverse());
    s.destroy();
  });

  it("Antwortfenster: Standard fragt nur bei passenden Effekten, „all“ bei jeder Möglichkeit", () => {
    /** Nächste Entscheidung nach „NS Enghexe → Suche“ (Schritt 1 der Combo). */
    const after = (chainPrompts: "auto" | "all", hand: number[], search: boolean) => {
      const s = DuelSession.start(core, data, { ...testhand, hand, chainPrompts });
      const d = new Driver(s);
      d.idle("summon", C.Angwitch);
      d.skipPlacement();
      d.activate(C.Angwitch);
      if (search) d.pick(C.Tatsunootoshigo);
      const t = s.decision!.msg.type;
      s.destroy();
      return t;
    };
    // Schnellzauber ohne Bezug: Standard überspringt das Fenster nach der Auflösung, „all“ fragt.
    expect(after("auto", [C.Angwitch, C.MementoFusion], true)).toBe(OcgMessageType.SELECT_IDLECMD);
    expect(after("all", [C.Angwitch, C.MementoFusion], true)).toBe(OcgMessageType.SELECT_CHAIN);
    // Verbotener Kelch kann den Effekt der Enghexe sinnvoll beantworten → wird auch im Standard angeboten.
    expect(after("auto", [C.Angwitch, C.ForbiddenChalice], false)).toBe(OcgMessageType.SELECT_CHAIN);
  });

});
