// Übersetzt jede Anfrage des Kerns in ein UI-neutrales Auswahlmodell.
// Konsole und mobile Oberfläche nutzen dieselben Modelle; nur die Darstellung unterscheidet sich.
import {
  OcgMessageType, type OcgAttribute, type OcgPosition, type OcgRace, OcgResponseType, SelectBattleCMDAction, SelectIdleCMDAction, cardMatchesOpcode,
  type OcgCardLoc, type OcgMessage, type OcgResponse,
} from "ocgcore-wasm";
import { toOcgCardData } from "../data/types";
import { cardName, describeString, type GameData } from "./data";
import { attributeList, positionName, raceList, zoneName } from "./text";

/** Verweis auf eine Karte im Duell (für Hervorhebung/Bild in der UI). */
export interface CardRef {
  code: number;
  controller: 0 | 1;
  location: number;
  sequence: number;
}

export interface MenuOption {
  label: string;
  card?: CardRef;
  /** Grobe Art der Aktion, damit die UI Symbole/Gruppen bilden kann. */
  tag?: string;
  response: OcgResponse;
}

export interface SelectItem {
  label: string;
  card?: CardRef;
}

export type Prompt =
  /** Eine Option antippen → sofort Antwort. */
  | { kind: "menu"; title: string; options: MenuOption[] }
  /** Mehrere Einträge wählen, dann bestätigen. */
  | {
      kind: "select"; title: string; items: SelectItem[]; min: number; max: number;
      validate(sel: number[]): boolean; build(sel: number[]): OcgResponse; cancel?: OcgResponse;
    }
  /** Reihenfolge festlegen (Einträge nacheinander antippen). */
  | { kind: "sort"; title: string; items: SelectItem[]; build(order: number[]): OcgResponse; skip: OcgResponse }
  /** Zählmarken verteilen. */
  | { kind: "counter"; title: string; items: (SelectItem & { max: number })[]; total: number; build(counts: number[]): OcgResponse }
  /** Kartennamen ansagen: Kandidaten sind bereits nach den Opcodes gefiltert. */
  | { kind: "announce-card"; title: string; candidates: number[]; build(code: number): OcgResponse };

export interface PromptContext {
  data: GameData;
  /** Letzter Auswahl-Hinweis (MSG_HINT / SELECTMSG) des Kerns, z. B. „Wähle eine Karte zum Abwerfen“. */
  hint?: bigint;
}

const ref = (c: OcgCardLoc): CardRef => ({ code: c.code, controller: c.controller, location: c.location, sequence: c.sequence });

function cardLabel(data: GameData, c: OcgCardLoc & { position?: number }) {
  return `${cardName(data, c.code)} (${c.controller === 1 ? "Gegner, " : ""}${zoneName(c.location, c.sequence)})`;
}

function bits(mask: number, width = 32): number[] {
  const out: number[] = [];
  for (let i = 0; i < width; i++) if (mask & (2 ** i)) out.push(2 ** i);
  return out;
}

/** Freie Zonen aus der Feldmaske (Bit gesetzt = nicht wählbar), relativ zum wählenden Spieler. */
export function freeZones(player: number, fieldMask: number) {
  const zones: { player: number; location: number; sequence: number; label: string }[] = [];
  for (let side = 0; side < 2; side++) {
    for (let seq = 0; seq < 7; seq++)
      if (!(fieldMask & (1 << (side * 16 + seq))))
        zones.push({ player: side === 0 ? player : 1 - player, location: 0x04, sequence: seq, label: (side ? "Gegner: " : "") + zoneName(0x04, seq) });
    for (let seq = 0; seq < 8; seq++)
      if (!(fieldMask & (1 << (side * 16 + 8 + seq))))
        zones.push({ player: side === 0 ? player : 1 - player, location: 0x08, sequence: seq, label: (side ? "Gegner: " : "") + zoneName(0x08, seq) });
  }
  return zones;
}

/** Prüfung für SELECT_SUM, identisch zur Prüfung im Kern (playerop.cpp). */
export function checkSum(params: number[], acc: number, atLeast: boolean): boolean {
  if (atLeast) {
    let sum = 0, mx = 0, mn = 0x7fffffff;
    for (const op of params) {
      const o1 = op & 0xffff, o2 = op >>> 16;
      const ms = o2 && o2 < o1 ? o2 : o1;
      sum += ms;
      mx += o2 > o1 ? o2 : o1;
      if (ms < mn) mn = ms;
    }
    return !(mx < acc || sum - mn >= acc);
  }
  const rec = (i: number, rest: number): boolean => {
    if (rest === 0 || i === params.length) return false;
    const o1 = params[i] & 0xffff, o2 = params[i] >>> 16;
    if (i === params.length - 1) return rest === o1 || rest === o2;
    return (rest > o1 && rec(i + 1, rest - o1)) || (o2 > 0 && rest > o2 && rec(i + 1, rest - o2));
  };
  return rec(0, acc);
}

export function buildPrompt(msg: OcgMessage, ctx: PromptContext): Prompt | null {
  const { data } = ctx;
  const name = (code: number) => cardName(data, code);
  const desc = (d: bigint) => describeString(data, d);
  const hintTitle = (fallback: string) => (ctx.hint ? desc(ctx.hint) : fallback);

  switch (msg.type) {
    case OcgMessageType.SELECT_IDLECMD: {
      const T = OcgResponseType.SELECT_IDLECMD, A = SelectIdleCMDAction;
      const o: MenuOption[] = [];
      msg.summons.forEach((c, i) => o.push({ label: `Normalbeschwörung: ${name(c.code)}`, card: ref(c), tag: "summon", response: { type: T, action: A.SELECT_SUMMON, index: i } }));
      msg.special_summons.forEach((c, i) => o.push({ label: `Spezialbeschwörung: ${name(c.code)}`, card: ref(c), tag: "spsummon", response: { type: T, action: A.SELECT_SPECIAL_SUMMON, index: i } }));
      msg.activates.forEach((c, i) => o.push({ label: `Aktivieren: ${name(c.code)} – ${desc(c.description)}`, card: ref(c), tag: "activate", response: { type: T, action: A.SELECT_ACTIVATE, index: i } }));
      msg.monster_sets.forEach((c, i) => o.push({ label: `Monster setzen: ${name(c.code)}`, card: ref(c), tag: "mset", response: { type: T, action: A.SELECT_MONSTER_SET, index: i } }));
      msg.spell_sets.forEach((c, i) => o.push({ label: `Setzen: ${name(c.code)}`, card: ref(c), tag: "sset", response: { type: T, action: A.SELECT_SPELL_SET, index: i } }));
      msg.pos_changes.forEach((c, i) => o.push({ label: `Position ändern: ${name(c.code)}`, card: ref(c), tag: "repos", response: { type: T, action: A.SELECT_POS_CHANGE, index: i } }));
      if (msg.to_bp) o.push({ label: "→ Battle Phase", tag: "phase", response: { type: T, action: A.TO_BP, index: null } });
      if (msg.to_ep) o.push({ label: "→ End Phase", tag: "phase", response: { type: T, action: A.TO_EP, index: null } });
      if (msg.shuffle) o.push({ label: "Hand mischen", tag: "shuffle", response: { type: T, action: A.SHUFFLE, index: null } });
      return { kind: "menu", title: "Main Phase – Aktion wählen", options: o };
    }
    case OcgMessageType.SELECT_BATTLECMD: {
      const T = OcgResponseType.SELECT_BATTLECMD, A = SelectBattleCMDAction;
      const o: MenuOption[] = [];
      msg.attacks.forEach((c, i) => o.push({ label: `Angriff: ${name(c.code)}${c.can_direct ? " (direkt möglich)" : ""}`, card: ref(c), tag: "attack", response: { type: T, action: A.SELECT_BATTLE, index: i } }));
      msg.chains.forEach((c, i) => o.push({ label: `Aktivieren: ${name(c.code)} – ${desc(c.description)}`, card: ref(c), tag: "activate", response: { type: T, action: A.SELECT_CHAIN, index: i } }));
      if (msg.to_m2) o.push({ label: "→ Main Phase 2", tag: "phase", response: { type: T, action: A.TO_M2, index: null } });
      if (msg.to_ep) o.push({ label: "→ End Phase", tag: "phase", response: { type: T, action: A.TO_EP, index: null } });
      return { kind: "menu", title: "Battle Phase – Aktion wählen", options: o };
    }
    case OcgMessageType.SELECT_EFFECTYN: {
      // Systemtexte wie 221 enthalten EDOPro-Platzhalter (%ls) – dann reicht der Kartenname im Titel.
      const raw = msg.description ? desc(msg.description) : "";
      const text = raw.includes("%") ? "" : raw;
      return {
        kind: "menu", title: `Effekt von „${name(msg.code)}“ aktivieren?${text ? ` (${text})` : ""}`,
        options: [
          { label: "Ja", card: ref(msg), response: { type: OcgResponseType.SELECT_EFFECTYN, yes: true } },
          { label: "Nein", response: { type: OcgResponseType.SELECT_EFFECTYN, yes: false } },
        ],
      };
    }
    case OcgMessageType.SELECT_YESNO:
      return {
        kind: "menu", title: desc(msg.description),
        options: [
          { label: "Ja", response: { type: OcgResponseType.SELECT_YESNO, yes: true } },
          { label: "Nein", response: { type: OcgResponseType.SELECT_YESNO, yes: false } },
        ],
      };
    case OcgMessageType.SELECT_OPTION:
      return {
        kind: "menu", title: hintTitle("Option wählen"),
        options: msg.options.map((d, i) => ({ label: desc(d), response: { type: OcgResponseType.SELECT_OPTION, index: i } })),
      };
    case OcgMessageType.SELECT_CHAIN: {
      const o: MenuOption[] = msg.selects.map((c, i) => ({
        label: `${name(c.code)} – ${desc(c.description)}`, card: ref(c), tag: "activate",
        response: { type: OcgResponseType.SELECT_CHAIN, index: i },
      }));
      if (!msg.forced) o.push({ label: "Nicht aktivieren", tag: "pass", response: { type: OcgResponseType.SELECT_CHAIN, index: null } });
      return { kind: "menu", title: msg.forced ? "Effekt aktivieren (Pflicht)" : "Als Kettenglied aktivieren?", options: o };
    }
    case OcgMessageType.SELECT_CARD: {
      const items = msg.selects.map((c) => ({ label: cardLabel(data, c), card: ref(c) }));
      return {
        kind: "select", title: hintTitle("Karte(n) wählen"), items, min: msg.min, max: msg.max,
        validate: (s) => s.length >= msg.min && s.length <= msg.max,
        build: (s) => ({ type: OcgResponseType.SELECT_CARD, indicies: s }),
        cancel: msg.can_cancel ? { type: OcgResponseType.SELECT_CARD, indicies: null } : undefined,
      };
    }
    case OcgMessageType.SELECT_TRIBUTE: {
      const items = msg.selects.map((c) => ({ label: cardLabel(data, c), card: ref(c) }));
      return {
        kind: "select", title: hintTitle("Tribut wählen"), items, min: msg.min, max: msg.max,
        validate: (s) => {
          const total = s.reduce((n, i) => n + msg.selects[i].release_param, 0);
          return total >= msg.min && s.length <= msg.max;
        },
        build: (s) => ({ type: OcgResponseType.SELECT_TRIBUTE, indicies: s }),
        cancel: msg.can_cancel ? { type: OcgResponseType.SELECT_TRIBUTE, indicies: null } : undefined,
      };
    }
    case OcgMessageType.SELECT_UNSELECT_CARD: {
      const o: MenuOption[] = [];
      msg.select_cards.forEach((c, i) => o.push({ label: `Wählen: ${cardLabel(data, c)}`, card: ref(c), tag: "select", response: { type: OcgResponseType.SELECT_UNSELECT_CARD, index: i } }));
      msg.unselect_cards.forEach((c, i) => o.push({ label: `Abwählen: ${cardLabel(data, c)}`, card: ref(c), tag: "unselect", response: { type: OcgResponseType.SELECT_UNSELECT_CARD, index: msg.select_cards.length + i } }));
      if (msg.can_finish) o.push({ label: "Fertig", tag: "finish", response: { type: OcgResponseType.SELECT_UNSELECT_CARD, index: null } });
      else if (msg.can_cancel) o.push({ label: "Abbrechen", tag: "cancel", response: { type: OcgResponseType.SELECT_UNSELECT_CARD, index: null } });
      return { kind: "menu", title: hintTitle("Karten wählen") + ` (${msg.min}–${msg.max})`, options: o };
    }
    case OcgMessageType.SELECT_PLACE:
    case OcgMessageType.SELECT_DISFIELD: {
      const zones = freeZones(msg.player, msg.field_mask);
      const rt = msg.type === OcgMessageType.SELECT_PLACE ? OcgResponseType.SELECT_PLACE : OcgResponseType.SELECT_DISFIELD;
      const place = (z: (typeof zones)[number]) => ({ player: z.player, location: z.location, sequence: z.sequence });
      // Bei SELECT_PLACE ist der Hinweis der Code der Karte, die platziert wird.
      const placing = ctx.hint !== undefined && data.cards.has(Number(ctx.hint)) ? name(Number(ctx.hint)) : null;
      const title = msg.type === OcgMessageType.SELECT_DISFIELD ? "Zone(n) wählen, die unbrauchbar werden"
        : placing ? `Zone für „${placing}“ wählen` : "Zone wählen";
      if (msg.count <= 1)
        return { kind: "menu", title, options: zones.map((z) => ({ label: z.label, tag: "zone", response: { type: rt, places: [place(z)] } as OcgResponse })) };
      return {
        kind: "select", title, items: zones.map((z) => ({ label: z.label })), min: msg.count, max: msg.count,
        validate: (s) => s.length === msg.count,
        build: (s) => ({ type: rt, places: s.map((i) => place(zones[i])) }) as OcgResponse,
      };
    }
    case OcgMessageType.SELECT_POSITION:
      return {
        kind: "menu", title: `Position für „${name(msg.code)}“`,
        options: bits(msg.positions, 4).map((p) => ({ label: positionName(p), tag: "position", response: { type: OcgResponseType.SELECT_POSITION, position: p as OcgPosition } })),
      };
    case OcgMessageType.SELECT_SUM: {
      const items = msg.selects.map((c) => ({ label: `${cardLabel(data, c)} [${c.amount & 0xffff}${c.amount >>> 16 ? "/" + (c.amount >>> 16) : ""}]`, card: ref(c) }));
      const must = msg.selects_must.map((c) => c.amount);
      const atLeast = !!msg.select_max;
      return {
        kind: "select",
        title: `${hintTitle("Karten wählen")} – Summe ${atLeast ? "mindestens" : "genau"} ${msg.amount}` +
          (msg.selects_must.length ? ` (fest dabei: ${msg.selects_must.map((c) => name(c.code)).join(", ")})` : ""),
        items, min: msg.min, max: msg.max,
        validate: (s) => (atLeast || (s.length >= msg.min && s.length <= msg.max)) && checkSum([...must, ...s.map((i) => msg.selects[i].amount)], msg.amount, atLeast),
        build: (s) => ({ type: OcgResponseType.SELECT_SUM, indicies: s }),
      };
    }
    case OcgMessageType.SORT_CARD:
    case OcgMessageType.SORT_CHAIN: {
      const items = msg.cards.map((c) => ({ label: cardLabel(data, c), card: ref(c) }));
      return {
        kind: "sort", title: msg.type === OcgMessageType.SORT_CHAIN ? "Reihenfolge der Kettenglieder festlegen" : hintTitle("Reihenfolge festlegen"), items,
        // order = Karten in gewünschter Reihenfolge; der Kern erwartet pro Karte ihren Rang.
        build: (order) => {
          const rank: number[] = [];
          order.forEach((cardIdx, pos) => (rank[cardIdx] = pos));
          return { type: OcgResponseType.SORT_CARD, order: rank };
        },
        skip: { type: OcgResponseType.SORT_CARD, order: null },
      };
    }
    case OcgMessageType.SELECT_COUNTER:
      return {
        kind: "counter", title: `${msg.count} Zählmarke(n) entfernen`, total: msg.count,
        items: msg.cards.map((c) => ({ label: cardLabel(data, c), card: ref(c), max: c.count })),
        build: (counts) => ({ type: OcgResponseType.SELECT_COUNTER, counters: counts }),
      };
    case OcgMessageType.ANNOUNCE_RACE: {
      const opts = raceList.filter(([r]) => (msg.available & r) !== 0n);
      return {
        kind: "select", title: `Typ ansagen (${msg.count})`, items: opts.map(([, l]) => ({ label: l })), min: msg.count, max: msg.count,
        validate: (s) => s.length === msg.count,
        build: (s) => ({ type: OcgResponseType.ANNOUNCE_RACE, races: s.map((i) => opts[i][0] as OcgRace) }),
      };
    }
    case OcgMessageType.ANNOUNCE_ATTRIB: {
      const opts = attributeList.filter(([a]) => (msg.available & a) !== 0);
      return {
        kind: "select", title: `Eigenschaft ansagen (${msg.count})`, items: opts.map(([, l]) => ({ label: l })), min: msg.count, max: msg.count,
        validate: (s) => s.length === msg.count,
        build: (s) => ({ type: OcgResponseType.ANNOUNCE_ATTRIB, attributes: s.map((i) => opts[i][0] as OcgAttribute) }),
      };
    }
    case OcgMessageType.ANNOUNCE_CARD: {
      const candidates: number[] = [];
      for (const c of data.cards.values()) if (!c.alias && cardMatchesOpcode(toOcgCardData(c), msg.opcodes)) candidates.push(c.id);
      return { kind: "announce-card", title: hintTitle("Kartennamen ansagen"), candidates, build: (code) => ({ type: OcgResponseType.ANNOUNCE_CARD, card: code }) };
    }
    case OcgMessageType.ANNOUNCE_NUMBER:
      return {
        kind: "menu", title: hintTitle("Zahl ansagen"),
        options: msg.options.map((n, i) => ({ label: String(n), response: { type: OcgResponseType.ANNOUNCE_NUMBER, value: i } })),
      };
    case OcgMessageType.ROCK_PAPER_SCISSORS:
      return {
        kind: "menu", title: "Schere, Stein, Papier",
        options: (["Schere", "Stein", "Papier"] as const).map((l, i) => ({ label: l, response: { type: OcgResponseType.ROCK_PAPER_SCISSORS, value: (i + 1) as 1 | 2 | 3 } })),
      };
    default:
      return null;
  }
}

/** Ist diese Nachricht eine Anfrage, die eine Antwort braucht? */
export function isRequest(msg: OcgMessage): boolean {
  switch (msg.type) {
    case OcgMessageType.SELECT_BATTLECMD: case OcgMessageType.SELECT_IDLECMD: case OcgMessageType.SELECT_EFFECTYN:
    case OcgMessageType.SELECT_YESNO: case OcgMessageType.SELECT_OPTION: case OcgMessageType.SELECT_CARD:
    case OcgMessageType.SELECT_CHAIN: case OcgMessageType.SELECT_PLACE: case OcgMessageType.SELECT_POSITION:
    case OcgMessageType.SELECT_TRIBUTE: case OcgMessageType.SORT_CHAIN: case OcgMessageType.SELECT_COUNTER:
    case OcgMessageType.SELECT_SUM: case OcgMessageType.SELECT_DISFIELD: case OcgMessageType.SORT_CARD:
    case OcgMessageType.SELECT_UNSELECT_CARD: case OcgMessageType.ROCK_PAPER_SCISSORS: case OcgMessageType.ANNOUNCE_RACE:
    case OcgMessageType.ANNOUNCE_ATTRIB: case OcgMessageType.ANNOUNCE_CARD: case OcgMessageType.ANNOUNCE_NUMBER:
      return true;
    default:
      return false;
  }
}
