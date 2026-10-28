// Duell in der Konsole bedienen – Headless-Steuerung für Schritt 2 und zum Debuggen.
//
//   npm run duel -- --deck decks/memento-test.ydk --hand 54550967 --seed 1234
//   npm run duel -- --second --opponent-ask --opponent-hand 14558127
//   npm run duel -- --input befehle.txt      # Eingaben aus Datei (eine pro Zeile)
//
// Eingaben: Nummer(n) der Option(en) · u = rückgängig · f = Feld · l = Protokoll · ? = Hilfe · q = Ende
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import createCore, { OcgLocation, type OcgCardQueryInfo } from "ocgcore-wasm";
import { loadBundle } from "../src/data/node-bundle";
import { parseYdk } from "../src/deck/ydk";
import { cardName, type GameData } from "../src/engine/data";
import { describeMessage } from "../src/engine/describe";
import { buildPrompt, type Prompt } from "../src/engine/prompts";
import { randomSeed } from "../src/engine/seed";
import { DuelSession, type DuelConfig } from "../src/engine/session";
import { positionName } from "../src/engine/text";

const argv = process.argv.slice(2);
const opt = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const flag = (name: string) => argv.includes(name);

function resolveCards(list: string | undefined, data: GameData): number[] {
  if (!list) return [];
  return list.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    if (/^\d+$/.test(s)) return Number(s);
    const low = s.toLowerCase();
    for (const c of data.cards.values()) if (c.name.toLowerCase() === low || c.nameDe?.toLowerCase() === low) return c.id;
    throw new Error(`Karte nicht gefunden: ${s} (Passcode oder exakter Name)`);
  });
}

async function main() {
  const data = loadBundle();
  const core = await createCore({ sync: true });
  const deck = parseYdk(readFileSync(opt("--deck") ?? "decks/memento-test.ydk", "utf8"));
  const config: DuelConfig = {
    deck,
    seed: opt("--seed") ? Number(opt("--seed")) : randomSeed(),
    goFirst: !flag("--second"),
    hand: resolveCards(opt("--hand"), data),
    fillHand: flag("--fill"),
    opponent: { hand: resolveCards(opt("--opponent-hand"), data), mode: flag("--opponent-ask") ? "ask" : "pass" },
  };
  if (!config.hand?.length) delete config.hand;
  console.log(`Datenpaket ${data.manifest.version} · Seed ${config.seed} · ${config.goFirst ? "erster" : "zweiter"} Zug`);

  const scripted = opt("--input") ? readFileSync(opt("--input")!, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")) : null;
  const rl = scripted ? null : createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q: string) => {
    if (scripted) {
      const line = scripted.shift();
      if (line === undefined) return "q";
      console.log(q + line);
      return line;
    }
    return rl!.question(q);
  };

  let s = DuelSession.start(core, data, config);
  let printed = 0;
  const printNew = () => {
    for (; printed < s.history.length; printed++) {
      const line = describeMessage(s.history[printed], data, s.me);
      if (line) console.log(line);
    }
  };

  for (;;) {
    printNew();
    if (s.result || !s.decision) {
      console.log("Duell beendet.");
      break;
    }
    const d = s.decision;
    const p = buildPrompt(d.msg, { data, hint: d.hint });
    if (!p) throw new Error(`Keine Darstellung für Nachricht ${d.msg.type}`);
    console.log(`\n${d.forOpponent ? "[GEGNER] " : ""}${p.title}`);
    printOptions(p, data);

    const input = (await ask("> ")).trim();
    if (input === "q") break;
    if (input === "?") { console.log("Nummer(n) wählen · u = rückgängig · f = Feld · l = Protokoll (Antworten) · q = Ende"); continue; }
    if (input === "f") { printField(s); continue; }
    if (input === "l") { console.log(JSON.stringify({ seed: config.seed, responses: s.responses }, (_k, v) => (typeof v === "bigint" ? v.toString() : v))); continue; }
    if (input === "u") {
      if (!s.responses.length) { console.log("Nichts zum Zurücknehmen."); continue; }
      s = s.undo();
      printed = s.history.length; // Verlauf nicht doppelt ausgeben
      console.log("↶ Letzte Entscheidung zurückgenommen.");
      continue;
    }
    const response = toResponse(p, input, data);
    if (!response) { console.log("Ungültige Eingabe."); continue; }
    if (!s.respond(response)) console.log("Der Kern hat diese Auswahl abgelehnt – bitte erneut wählen.");
  }
  rl?.close();
  s.destroy();
}

function printOptions(p: Prompt, data: GameData) {
  switch (p.kind) {
    case "menu":
      p.options.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
      break;
    case "select":
      p.items.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
      console.log(`  Wähle ${p.min === p.max ? p.min : `${p.min}–${p.max}`} (Nummern mit Leerzeichen)${p.cancel ? " · 0 = abbrechen" : ""}`);
      break;
    case "sort":
      p.items.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
      console.log("  Reihenfolge angeben, z. B. „3 1 2“ (zuerst = oben/erstes Glied) · 0 = Standard");
      break;
    case "counter":
      p.items.forEach((o, i) => console.log(`  ${i + 1}) ${o.label} (max ${o.max})`));
      console.log(`  Anzahl je Karte angeben, Summe ${p.total}, z. B. „1 0 2“`);
      break;
    case "announce-card":
      console.log(`  ${p.candidates.length} mögliche Karten. Suchbegriff eingeben, dann Nummer: „suche Ash“ → „#2“`);
      if (p.candidates.length <= 15) p.candidates.forEach((c, i) => console.log(`  ${i + 1}) ${cardName(data, c)}`));
      break;
  }
}

let lastSearch: number[] = [];
function toResponse(p: Prompt, input: string, data: GameData) {
  const nums = input.split(/\s+/).map(Number);
  const valid = nums.every((n) => Number.isInteger(n));
  switch (p.kind) {
    case "menu":
      return valid && nums.length === 1 ? p.options[nums[0] - 1]?.response ?? null : null;
    case "select": {
      if (input === "0" && p.cancel) return p.cancel;
      const sel = nums.map((n) => n - 1);
      if (!valid || sel.some((i) => i < 0 || i >= p.items.length) || new Set(sel).size !== sel.length) return null;
      if (!p.validate(sel)) { console.log("Diese Auswahl erfüllt die Bedingungen nicht."); return null; }
      return p.build(sel);
    }
    case "sort": {
      if (input === "0") return p.skip;
      const order = nums.map((n) => n - 1);
      if (!valid || order.length !== p.items.length || new Set(order).size !== order.length) return null;
      return p.build(order);
    }
    case "counter":
      if (!valid || nums.length !== p.items.length || nums.reduce((a, b) => a + b, 0) !== p.total) return null;
      return p.build(nums);
    case "announce-card": {
      if (input.startsWith("suche ")) {
        const q = input.slice(6).toLowerCase();
        lastSearch = p.candidates.filter((c) => cardName(data, c).toLowerCase().includes(q) || data.cards.get(c)!.name.toLowerCase().includes(q)).slice(0, 20);
        lastSearch.forEach((c, i) => console.log(`  #${i + 1} ${cardName(data, c)}`));
        return null;
      }
      const m = /^#?(\d+)$/.exec(input);
      const list = input.startsWith("#") ? lastSearch : p.candidates;
      return m && list[Number(m[1]) - 1] ? p.build(list[Number(m[1]) - 1]) : null;
    }
  }
}

function printField(s: DuelSession) {
  const fmt = (c: Partial<OcgCardQueryInfo> | null) => (c ? `${c.code ? s.name(c.code) : "?"} [${positionName(c.position ?? 0)}${c.attack !== undefined && c.position && c.position & 0x5 ? `, ${c.attack}/${c.defense}` : ""}]` : "—");
  for (const p of [1 - s.me, s.me] as (0 | 1)[]) {
    console.log(`\n${p === s.me ? "DU" : "GEGNER"} (${s.lp[p]} LP) · Deck ${s.count(p, OcgLocation.DECK)} · Extra ${s.count(p, OcgLocation.EXTRA)}`);
    console.log(`  Monster:  ${s.cards(p, OcgLocation.MZONE).map(fmt).join(" | ")}`);
    console.log(`  Zauber/F: ${s.cards(p, OcgLocation.SZONE).map(fmt).join(" | ")}`);
    console.log(`  Hand:     ${s.cards(p, OcgLocation.HAND).map((c) => (c?.code ? s.name(c.code) : "?")).join(", ") || "—"}`);
    console.log(`  Friedhof: ${s.cards(p, OcgLocation.GRAVE).map((c) => s.name(c!.code!)).join(", ") || "—"}`);
    console.log(`  Verbannt: ${s.cards(p, OcgLocation.REMOVED).map((c) => (c?.code ? s.name(c.code) : "?")).join(", ") || "—"}`);
  }
  console.log();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
