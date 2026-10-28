// Beschreibungen des Kerns: Systemtexte, Kartentexte (aux.Stringid = code << 20 | n), reine Kartencodes.
import { beforeAll, describe, expect, it } from "vitest";
import { bundleExists, loadBundle } from "../src/data/node-bundle";
import { describeString, type GameData } from "../src/engine/data";
import { C } from "../src/fixtures/memento";

let data: GameData;
beforeAll(() => { if (bundleExists()) data = loadBundle(); });

describe.skipIf(!bundleExists())("describeString", () => {
  it("Systemtext (deutsch)", () => expect(describeString(data, 500n)).toBe("Wähle eine Karte zum Tributieren"));
  it("Kartentext über aux.Stringid", () => {
    expect(describeString(data, (BigInt(C.Tatsunootoshigo) << 20n) | 1n)).toBe('Send "Memento" monsters from your Deck to the GY');
  });
  it("reiner Kartencode als Hinweis", () => expect(describeString(data, BigInt(C.Angwitch))).toBe("Mementotlanische Enghexe"));
});
