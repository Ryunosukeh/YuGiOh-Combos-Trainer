// Kompaktes Combo-Protokoll: eine Zeile pro Aktion bzw. aufgelöstem Effekt, z. B.
// „Mementotlanische Enghexe: sucht Mementotlanischer Tatsunootoshigo“.
// Grundlage sind die Nachrichten des Kerns inkl. Bewegungsgrund (MOVE.reason, per Patch gelesen).
import { OcgLocation, OcgMessageType, type OcgMessage } from "ocgcore-wasm";
import { cardName, type GameData } from "./data";

const R = {
  DESTROY: 0x1, RELEASE: 0x2, MATERIAL: 0x8, EFFECT: 0x40, COST: 0x80, RULE: 0x400, SPSUMMON: 0x800,
  DISCARD: 0x4000, FUSION: 0x40000, SYNCHRO: 0x80000, RITUAL: 0x100000, XYZ: 0x200000, LINK: 0x10000000,
} as const;
const L = OcgLocation;

export interface ComboLine {
  turn: number;
  /** Spieler, der die Aktion ausführt (absolut). */
  player: 0 | 1;
  text: string;
  /** Überschrift/Phasenhinweis statt nummerierter Aktion. */
  kind: "turn" | "phase" | "action";
}

interface Move { card: number; from: number; to: number; fromCtrl: number; reason: number }
type Event = { kind: "move"; move: Move } | { kind: "summon"; code: number } | { kind: "set"; code: number };
interface Resolving { code: number; player: 0 | 1; costs: Move[]; negated: boolean; events: Event[] }

export function comboLog(history: OcgMessage[], data: GameData, me: 0 | 1): ComboLine[] {
  const name = (c: number) => (c ? cardName(data, c) : "eine verdeckte Karte");
  const lines: ComboLine[] = [];
  let turn = 0;
  let turnPlayer: 0 | 1 = 0;
  const chain: { code: number; player: 0 | 1; costs: Move[]; negated: boolean }[] = [];
  let resolving: Resolving | null = null;
  let pending: Move[] = []; // Bewegungen außerhalb einer Auflösung (Kosten von Beschwörungsverfahren usw.)

  const push = (player: 0 | 1, text: string, kind: ComboLine["kind"] = "action") => lines.push({ turn, player, text, kind });

  for (const m of history) {
    switch (m.type) {
      case OcgMessageType.NEW_TURN:
        turn++;
        turnPlayer = m.player as 0 | 1;
        push(turnPlayer, `Zug ${turn} (${turnPlayer === me ? "du" : "Gegner"})`, "turn");
        pending = [];
        break;
      case OcgMessageType.NEW_PHASE:
        if (m.phase === 0x8) push(turnPlayer, "Battle Phase", "phase");
        else if (m.phase === 0x200) push(turnPlayer, "End Phase", "phase");
        break;
      case OcgMessageType.DRAW:
        if (turn > 0) push(m.player as 0 | 1, m.player === me ? `zieht ${m.drawn.map((d) => name(d.code)).join(", ")}` : `Gegner zieht ${m.drawn.length} Karte${m.drawn.length === 1 ? "" : "n"}`);
        break;
      case OcgMessageType.MOVE: {
        const mv: Move = { card: m.card, from: m.from.location, to: m.to.location, fromCtrl: m.from.controller, reason: (m as { reason?: number }).reason ?? 0 };
        if (!mv.from || mv.from === mv.to) break;
        if (resolving) resolving.events.push({ kind: "move", move: mv });
        else if (chain.length && mv.reason & R.COST) chain[chain.length - 1].costs.push(mv);
        else pending.push(mv);
        break;
      }
      case OcgMessageType.SET:
        if (resolving) resolving.events.push({ kind: "set", code: m.code });
        else { push(m.controller, `setzt ${m.controller === me ? name(m.code) : "eine Karte"}`); pending = []; }
        break;
      case OcgMessageType.SUMMONING: {
        const tributes = pending.filter((p) => p.reason & R.RELEASE).map((p) => name(p.card));
        push(m.controller, `NS ${name(m.code)}${tributes.length ? ` (Tribut: ${tributes.join(", ")})` : ""}`);
        pending = [];
        break;
      }
      case OcgMessageType.FLIPSUMMONING:
        push(m.controller, `Flippbeschwörung ${name(m.code)}`);
        break;
      case OcgMessageType.SPSUMMONING:
        if (resolving) { resolving.events.push({ kind: "summon", code: m.code }); break; }
        // Beschwörung per Verfahren (Link, Xyz, Synchro, eigene Bedingung): Material/Kosten aus pending
        push(m.controller, `SS ${name(m.code)}${procedureNote(pending, name)}`);
        pending = [];
        break;
      case OcgMessageType.CHAINING:
        chain.push({ code: m.code, player: m.controller, costs: [], negated: false });
        pending = [];
        break;
      case OcgMessageType.CHAIN_NEGATED:
      case OcgMessageType.CHAIN_DISABLED: {
        const link = chain[m.chain_size - 1];
        if (link) link.negated = true;
        break;
      }
      case OcgMessageType.CHAIN_SOLVING: {
        const link = chain[m.chain_size - 1];
        if (link) resolving = { ...link, events: [] };
        break;
      }
      case OcgMessageType.CHAIN_SOLVED:
        if (resolving) push(resolving.player, resolutionText(resolving, name));
        resolving = null;
        break;
      case OcgMessageType.CHAIN_END:
        chain.length = 0;
        resolving = null;
        pending = [];
        break;
      case OcgMessageType.DAMAGE:
        push(m.player as 0 | 1, `${m.player === me ? "Du" : "Gegner"}: −${m.amount} LP`);
        break;
      case OcgMessageType.WIN:
        push(me, m.player === me ? "Du gewinnst das Duell" : "Der Gegner gewinnt das Duell", "phase");
        break;
    }
  }
  return lines;
}

/** Text für einen aufgelösten Effekt – Teilsätze in der Reihenfolge, in der es passiert ist. */
function resolutionText(r: Resolving, name: (c: number) => string): string {
  const costs = r.costs.length ? ` (Kosten: ${phrases(r.costs, r.code, name).join(", ")})` : "";
  if (r.negated) return `${name(r.code)}: annulliert${costs}`;
  const moves = r.events.flatMap((e) => (e.kind === "move" ? [e.move] : []));
  const materials = moves.filter((m) => m.reason & R.MATERIAL);
  const kind = materials.length ? materialKind(materials[0].reason) : null;

  // Gruppen in Reihenfolge des ersten Auftretens; Beschwörungen als eigene Teilsätze an ihrer Stelle.
  const parts = new Map<string, number[]>();
  const add = (template: string, card: number) => parts.set(template, [...(parts.get(template) ?? []), card]);
  r.events.forEach((e, i) => {
    if (e.kind === "summon") {
      if (kind) parts.set(`${kind} ${name(e.code)} (Material: ${materials.map((m) => name(m.card)).join(", ")})#${i}`, []);
      else if (e.code === r.code) parts.set(`beschwört sich als Spezialbeschwörung#${i}`, []);
      else add("SS {}", e.code);
    } else if (e.kind === "set") {
      if (!moves.some((m) => m.card === e.code && m.to === L.SZONE)) add("setzt {}", e.code);
    } else if (!(e.move.reason & R.MATERIAL)) {
      const t = template(e.move);
      if (t) add(t, e.move.card);
    }
  });
  const text = [...parts].map(([t, cards]) => fill(t.replace(/#\d+$/, ""), cards, r.code, moves, name));
  return `${name(r.code)}: ${text.length ? text.join(", ") : "wird aktiviert"}${costs}`;
}

/** Satzvorlage für eine Bewegung (`{}` = Kartenliste) oder null, wenn sie nicht erwähnt wird. */
function template(m: Move): string | null {
  if (m.reason & R.RULE && m.to === L.GRAVE) return null; // z. B. Zauber nach Auflösung in den Friedhof
  if (m.to === L.MZONE && m.reason & R.SPSUMMON) return null; // steht schon als Beschwörung da
  if (m.to === L.SZONE && m.from === L.HAND) return null; // Aktivierung aus der Hand
  if (m.to === L.HAND) return m.from === L.DECK ? "sucht {}" : "holt {} auf die Hand";
  if (m.to === L.GRAVE && m.reason & R.DESTROY) return "zerstört {}";
  if (m.to === L.GRAVE && m.reason & R.DISCARD) return "wirft {} ab";
  if (m.to === L.GRAVE && (m.from === L.DECK || m.from === L.EXTRA)) return "legt {} in den Friedhof";
  if (m.to === L.GRAVE) return "schickt {} in den Friedhof";
  if (m.to === L.REMOVED) return "verbannt {}";
  if (m.to === L.DECK || m.to === L.EXTRA) return "mischt {} ins Deck";
  if (m.to === L.SZONE) return "setzt {}";
  if (m.to === L.MZONE) return "bringt {} aufs Feld";
  return null;
}

/**
 * Kartenliste einsetzen. „sich“ nur für die auflösende Karte selbst – nicht für ein gleichnamiges
 * Exemplar aus Deck/Extra Deck (z. B. ein zweiter Schöpfungskönig).
 */
function fill(t: string, cards: number[], self: number, moves: Move[], name: (c: number) => string): string {
  if (!t.includes("{}")) return t;
  const isSelf = (c: number) => c === self && moves.some((m) => m.card === c && m.from !== L.DECK && m.from !== L.EXTRA);
  return t.replace("{}", cards.map((c) => (isSelf(c) ? "sich" : name(c))).join(", "));
}

/** Bewegungen zu kurzen Phrasen bündeln (für Kosten). */
function phrases(moves: Move[], self: number, name: (c: number) => string): string[] {
  const groups = new Map<string, number[]>();
  for (const m of moves) { const t = template(m); if (t) groups.set(t, [...(groups.get(t) ?? []), m.card]); }
  return [...groups].map(([t, cards]) => fill(t, cards, self, moves, name));
}

function procedureNote(pending: Move[], name: (c: number) => string): string {
  const mats = pending.filter((p) => p.reason & (R.MATERIAL | R.COST));
  if (!mats.length) return "";
  const kind = materialKind(mats[0].reason);
  if (kind) return ` (Material: ${mats.map((m) => name(m.card)).join(", ")})`;
  const to = mats[0].to === L.DECK || mats[0].to === L.EXTRA ? "ins Deck gemischt" : mats[0].to === L.REMOVED ? "verbannt" : "in den Friedhof";
  return ` (${mats.map((m) => name(m.card)).join(", ")} ${to})`;
}

function materialKind(reason: number): string | null {
  if (reason & R.FUSION) return "Fusionsbeschwörung";
  if (reason & R.SYNCHRO) return "Synchrobeschwörung";
  if (reason & R.XYZ) return "Xyz-Beschwörung";
  if (reason & R.LINK) return "Linkbeschwörung";
  if (reason & R.RITUAL) return "Ritualbeschwörung";
  return null;
}

/** Protokoll als kopierbarer Text. */
export function comboLogText(lines: ComboLine[]): string {
  const out: string[] = [];
  let n = 0;
  for (const l of lines) {
    if (l.kind === "turn") { n = 0; out.push(out.length ? `\n${l.text}` : l.text); }
    else if (l.kind === "phase") out.push(`— ${l.text}`);
    else out.push(`${++n}. ${l.text}`);
  }
  return out.join("\n");
}
