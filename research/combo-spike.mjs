// Ausführen: node --no-warnings research/combo-spike.mjs <ordner mit CardScripts/ und BabelCDB/> (benötigt ocgcore-wasm@0.1.6)
// Wegwerf-Machbarkeitstest: Abnahme-Combo headless gegen ocgcore-wasm.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import createCore, {
  OcgDuelMode, OcgLocation, OcgPosition, OcgProcessResult, OcgMessageType,
  OcgResponseType, OcgType, SelectIdleCMDAction, ocgMessageTypeStrings,
} from "ocgcore-wasm";

const EXT = process.argv[2];
const SCRIPTS = path.join(EXT, "CardScripts");
const db = new DatabaseSync(path.join(EXT, "BabelCDB/cards.cdb"));
const cards = new Map(), names = new Map();
const stmt = db.prepare("SELECT d.*, t.name FROM datas d JOIN texts t USING(id)"); stmt.setReadBigInts(true);
for (const raw of stmt.all()) {
  const d = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === "setcode" || k === "race" || typeof v !== "bigint" ? v : Number(v)]));
  const setcodes = [...new Uint16Array(BigUint64Array.from([d.setcode]).buffer)].filter(Boolean);
  const isLink = d.type & OcgType.LINK;
  cards.set(d.id, { code: d.id, alias: d.alias, setcodes, type: d.type, attack: d.atk,
    defense: isLink ? 0 : d.def, link_marker: isLink ? d.def : 0, level: d.level & 0xff,
    lscale: (d.level >> 24) & 0xff, rscale: (d.level >> 16) & 0xff, race: BigInt(d.race), attribute: d.attribute });
  names.set(d.id, d.name);
}
const N = (c) => names.get(c) ?? c;

const MAIN = { 81677154:3, 54550967:2 /* +1 Hand */, 18165869:3, 50042011:2, 17943271:2, 52918032:1, 81945676:1,
  54207171:1, 55272555:1, 23288411:1, 24079759:1, 14558127:2, 94145021:1, 42141493:1, 84192580:1, 43338320:1,
  80722024:3, 66518509:3, 48130397:3, 29111045:3, 90711610:1, 20508881:2, 5318639:1, 25789292:1 };
const EXTRA = { 14529511:3, 19181420:1, 69946549:1, 11765832:1, 54757758:1, 69601012:1, 11321089:1, 8264361:1,
  98127546:1, 12067160:1, 65741786:1, 29301450:1, 93039339:1 };
const HAND = [54550967];

const core = await createCore({ sync: true });
console.log("OCGCORE", core.getVersion());
const handle = core.createDuel({
  flags: OcgDuelMode.MODE_MR5, seed: [42n, 7n, 3n, 1n],
  team1: { drawCountPerTurn: 1, startingDrawCount: 0, startingLP: 8000 },
  team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
  cardReader: (code) => cards.get(code) ?? null,
  scriptReader: (name) => {
    for (const p of [path.join(SCRIPTS, "official", name), path.join(SCRIPTS, name), path.join(SCRIPTS, "unofficial", name)])
      if (existsSync(p)) return readFileSync(p, "utf8");
    if (!/^c(0|\d+)\.lua$/.test(name) || cards.get(+name.slice(1, -4))?.type & OcgType.EFFECT) console.warn("SCRIPT FEHLT", name); return "";
  },
  errorHandler: (t, txt) => console.warn("CORE-FEHLER", t, txt),
});
for (const s of ["constant.lua", "utility.lua"]) core.loadScript(handle, s, readFileSync(path.join(SCRIPTS, s), "utf8"));
const add = (team, code, location) => core.duelNewCard(handle, { code, team, duelist: 0, controller: team,
  location, sequence: 0, position: location === OcgLocation.HAND ? OcgPosition.FACEDOWN_ATTACK : OcgPosition.FACEDOWN_DEFENSE });
for (const [c, n] of Object.entries(MAIN)) for (let i = 0; i < n; i++) add(0, +c, OcgLocation.DECK);
for (const [c, n] of Object.entries(EXTRA)) for (let i = 0; i < n; i++) add(0, +c, OcgLocation.EXTRA);
for (const c of HAND) add(0, c, OcgLocation.HAND);
for (let i = 0; i < 40; i++) add(1, 89631139, OcgLocation.DECK); // Dummy: Vanilla-Deck
globalThis.__t0 = performance.now();
core.startDuel(handle);

// Combo-Plan: jeder Eintrag beantwortet genau eine Entscheidung von Spieler 0.
const T = OcgMessageType, IDLE = SelectIdleCMDAction;
const idle = (action, list, code, desc) => (m) => {
  const i = m[list].findIndex((c) => c.code === code && (desc === undefined || (c.description & 0xfn) === BigInt(desc)));
  if (i < 0) throw new Error(`nicht verfügbar: ${N(code)} in ${list}: ` + m[list].map((c) => N(c.code) + "#" + (c.description ?? "")).join(", "));
  return { type: OcgResponseType.SELECT_IDLECMD, action, index: i };
};
const pickCards = (...codes) => (m) => {
  const used = new Set(), idx = codes.map((c) => { const i = m.selects.findIndex((s, j) => s.code === c && !used.has(j)); if (i < 0) throw new Error("Karte nicht wählbar: " + N(c)); used.add(i); return i; });
  return { type: OcgResponseType.SELECT_CARD, indicies: idx };
};
const pickLoc = (code, location) => (m) => {
  const i = m.selects.findIndex((s) => s.code === code && s.location === location);
  if (i < 0) throw new Error("Karte nicht wählbar: " + N(code)); return { type: OcgResponseType.SELECT_CARD, indicies: [i] };
};
const chain = (code) => Object.assign((m) => {
  const i = m.selects.findIndex((s) => s.code === code);
  if (i < 0) throw new Error("Kettenoption fehlt: " + N(code) + " / " + m.selects.map((s) => N(s.code)).join(", "));
  return { type: OcgResponseType.SELECT_CHAIN, index: i };
}, { code });
const yes = () => ({ type: OcgResponseType.SELECT_EFFECTYN, yes: true });

const plan = [
  ["1 NS Enghexe", T.SELECT_IDLECMD, idle(IDLE.SELECT_SUMMON, "summons", 54550967)],
  ["1 Enghexe-Trigger", T.SELECT_CHAIN, chain(54550967)],
  ["1 sucht Tatsu", T.SELECT_CARD, pickCards(81677154)],
  ["2 SS Tatsu", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 81677154, 0)],
  ["3 Tatsu-Effekt", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 81677154, 1)],
  ["3 zerstört Tatsu", T.SELECT_CARD, pickCards(81677154)],
  ["3 Deck->GY", T.SELECT_UNSELECT_CARD, null /* dynamisch */],
  ["4 Dachbodengeist SS", T.SELECT_CHAIN, chain(52918032)],
  ["4 Dachbodengeist-Trigger", T.SELECT_CHAIN, chain(52918032)],
  ["4 Ziel Tatsu", T.SELECT_CARD, pickCards(81677154)],
  ["5 Enghexe 2", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 54550967, 1)],
  ["5 Ziel Stab", T.SELECT_CARD, pickCards(81945676)],
  ["5 zerstört Enghexe", T.SELECT_CARD, pickCards(54550967)],
  ["6 Stab-Effekt", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 81945676, 1)],
  ["6 zerstört Dachbodengeist", T.SELECT_CARD, pickCards(52918032)],
  ["6 sucht Fusion", T.SELECT_CARD, pickCards(66518509)],
  ["7 Fusion aktivieren", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 66518509)],
  ["7 Schöpfungskönig wählen", T.SELECT_CARD, pickCards(14529511)],
  ["7 Materialien", T.SELECT_UNSELECT_CARD, null],
  ["8 König-Trigger", T.SELECT_CHAIN, chain(14529511)],
  ["8 3 Karten in GY", T.SELECT_CARD, pickCards(14529511, 23288411, 54207171)],
  ["9 König verbannen", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 14529511, 0)],
  ["9 sucht Mictlan", T.SELECT_CARD, pickCards(43338320)],
  ["9 Mictlan aktivieren", T.SELECT_IDLECMD, idle(IDLE.SELECT_ACTIVATE, "activates", 43338320)],
  ["10 Kombinierte Schöpfung SS", T.SELECT_IDLECMD, idle(IDLE.SELECT_SPECIAL_SUMMON, "special_summons", 23288411)],
  ["10 5 Materialien", T.SELECT_UNSELECT_CARD, null],
  ["11 End Phase", T.SELECT_IDLECMD, (m) => ({ type: OcgResponseType.SELECT_IDLECMD, action: IDLE.TO_EP, index: null })],
  ["11 Mictlan-EP-Trigger", T.SELECT_CHAIN, chain(43338320)],
  ["11 Ziel Fusion", T.SELECT_CARD, pickCards(66518509)],
];
// SELECT_UNSELECT_CARD-Wünsche pro Schritt (Reihenfolge der Auswahl).
const unsel = {
  "3 Deck->GY": [52918032, 17943271, 81945676],
  "7 Materialien": [[54550967, OcgLocation.GRAVE], [81677154, OcgLocation.HAND], [81945676, OcgLocation.MZONE]],
  "10 5 Materialien": [17943271, 52918032, 81677154, 81945676, 54207171],
};
const unselState = {};
let pendingFinish = false;

const log = [];
function respond(m) {
  if (process.env.DBG) log.push("    ? " + (ocgMessageTypeStrings.get?.(m.type) ?? m.type) + " p" + m.player + " " + JSON.stringify(m, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 300));
  const name = ocgMessageTypeStrings.get?.(m.type) ?? m.type;
  if (m.player === 1) {
    if (m.type === T.SELECT_CHAIN) return { type: OcgResponseType.SELECT_CHAIN, index: null };
    if (m.type === T.SELECT_IDLECMD) return { type: OcgResponseType.SELECT_IDLECMD, action: IDLE.TO_EP, index: null };
    if (m.type === T.SELECT_BATTLECMD) return { type: OcgResponseType.SELECT_BATTLECMD, action: 3, index: null };
  }
  // Standardantworten für Dinge, die der Plan nicht steuert
  if (m.type === T.SELECT_PLACE) {
    const own = m.player === 0;
    for (let s = 0; s < 7; s++) if (!(m.field_mask & (1 << s))) return { type: OcgResponseType.SELECT_PLACE, places: [{ player: m.player, location: OcgLocation.MZONE, sequence: s }] };
    for (let s = 0; s < 8; s++) if (!(m.field_mask & (1 << (s + 8)))) return { type: OcgResponseType.SELECT_PLACE, places: [{ player: m.player, location: OcgLocation.SZONE, sequence: s }] };
  }
  if (m.type === T.SELECT_POSITION) return { type: OcgResponseType.SELECT_POSITION, position: m.positions & OcgPosition.FACEUP_ATTACK ? OcgPosition.FACEUP_ATTACK : OcgPosition.FACEUP_DEFENSE };
  if (m.type === T.SELECT_EFFECTYN && plan[0]?.[1] === T.SELECT_CHAIN && plan[0][2].code === m.code) { log.push("✔ " + plan.shift()[0] + " (EffectYN)"); return yes(); }
  if (m.type === T.SELECT_EFFECTYN || m.type === T.SELECT_YESNO) { log.push("  (Ja auf " + name + ")"); return { type: m.type === T.SELECT_YESNO ? OcgResponseType.SELECT_YESNO : OcgResponseType.SELECT_EFFECTYN, yes: true }; }
  if (m.type === T.SELECT_UNSELECT_CARD && pendingFinish && m.can_finish) { pendingFinish = false; return { type: OcgResponseType.SELECT_UNSELECT_CARD, index: null }; }
  pendingFinish = false;
  const step = plan[0];
  if (m.type === T.SELECT_CHAIN && step?.[1] === T.SELECT_CHAIN && !m.selects.length) return { type: OcgResponseType.SELECT_CHAIN, index: null };
  if (step && step[1] === m.type) {
    if (m.type === T.SELECT_UNSELECT_CARD) {
      const want = unsel[step[0]], st = (unselState[step[0]] ??= { i: 0 });
      const w = want[st.i++], [code, loc] = Array.isArray(w) ? w : [w, undefined];
      const i = m.select_cards.findIndex((c) => c.code === code && (loc === undefined || c.location === loc));
      if (i < 0) throw new Error(`${step[0]}: nicht wählbar ${N(code)}; Optionen: ` + m.select_cards.map((c) => N(c.code) + "@" + c.location).join(", "));
      if (st.i === want.length) { plan.shift(); log.push("✔ " + step[0]); pendingFinish = true; }
      return { type: OcgResponseType.SELECT_UNSELECT_CARD, index: i };
    }
    plan.shift(); log.push("✔ " + step[0]);
    return step[2](m);
  }
  if (m.type === T.SELECT_CHAIN && !m.forced) return { type: OcgResponseType.SELECT_CHAIN, index: null };
  if (m.type === T.SELECT_IDLECMD && !plan.length) return null;
  throw new Error(`Unerwartet ${name} (erwartet: ${step?.[0]}) ` + JSON.stringify(m, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 600));
}

let turns = 0, last = null;
try {
outer: while (true) {
  const st = core.duelProcess(handle);
  for (const m of core.duelGetMessage(handle)) {
    last = m;
    if (m.type === T.NEW_TURN && ++turns > 1) break outer;
    if (m.type === T.NEW_PHASE) log.push("  [PHASE] " + m.phase);
    if ([T.SUMMONING, T.SPSUMMONING, T.CHAINING].includes(m.type)) log.push(`  [${ocgMessageTypeStrings.get?.(m.type) ?? m.type}] ${N(m.code)}`);
    if (m.type === T.MOVE) log.push(`  [MOVE] ${N(m.card)} ${m.from?.location}->${m.to?.location}`);
  }
  if (st === OcgProcessResult.END) break;
  if (st === OcgProcessResult.CONTINUE) continue;
  const r = respond(last);
  if (r === null) break;
  core.duelSetResponse(handle, r);
}
} catch (e) { console.log(log.join("\n")); console.error("ABBRUCH:", e.message); process.exit(1); }
console.log(log.join("\n"));
console.log("Duell-Laufzeit ms", (performance.now() - globalThis.__t0).toFixed(0));
console.log(plan.length ? "OFFEN: " + plan.map((p) => p[0]).join(" | ") : "COMBO KOMPLETT");
