// Serialisierbare Momentaufnahme eines Duells für die Oberfläche (wird vom Worker per postMessage geschickt).
import { OcgLocation, OcgQueryFlags, type OcgCardQueryInfo, type OcgChain, type OcgQueryFlags as Flags } from "ocgcore-wasm";
import type { Decision, DuelSession } from "./session";

export interface CardView {
  code: number;
  position: number;
  /** Aktuelle Werte (nur offene Monster im Feld). */
  atk?: number;
  def?: number;
  level?: number;
  rank?: number;
  link?: number;
  overlays?: number[];
  counters?: Record<number, number>;
}

export interface PlayerView {
  lp: number;
  hand: CardView[];
  /** 7 Plätze: 0–4 Hauptmonsterzonen, 5/6 Extra Monster Zonen (aus Sicht des Besitzers links/rechts). */
  mzone: (CardView | null)[];
  /** 8 Plätze: 0–4 Zauber/Fallen, 5 Feldzone, 6/7 (alte Pendelzonen, in MR5 ungenutzt). */
  szone: (CardView | null)[];
  grave: CardView[];
  removed: CardView[];
  extra: CardView[];
  deckCount: number;
  extraCount: number;
}

export interface ChainLinkView {
  code: number;
  controller: 0 | 1;
  location: number;
  sequence: number;
  description: bigint;
}

export interface DuelView {
  me: 0 | 1;
  turn: number;
  turnPlayer: 0 | 1;
  phase: number;
  players: [PlayerView, PlayerView];
  chain: ChainLinkView[];
  decision: Decision | null;
  result: { winner: number; reason: number } | null;
  /** Anzahl Nutzerentscheidungen (für „Rückgängig“). */
  steps: number;
}

const FLAGS = (OcgQueryFlags.CODE | OcgQueryFlags.POSITION | OcgQueryFlags.ATTACK | OcgQueryFlags.DEFENSE | OcgQueryFlags.LEVEL |
  OcgQueryFlags.RANK | OcgQueryFlags.LINK | OcgQueryFlags.OVERLAY_CARD | OcgQueryFlags.COUNTERS) as Flags;

function toView(c: Partial<OcgCardQueryInfo> | null): CardView | null {
  if (!c) return null;
  const v: CardView = { code: c.code ?? 0, position: c.position ?? 0 };
  if (c.attack !== undefined) v.atk = c.attack;
  if (c.defense !== undefined) v.def = c.defense;
  if (c.level) v.level = c.level;
  if (c.rank) v.rank = c.rank;
  if (c.link?.rating) v.link = c.link.rating;
  if (c.overlayCards?.length) v.overlays = c.overlayCards;
  if (c.counters && Object.keys(c.counters).length) v.counters = c.counters;
  return v;
}

export function buildView(s: DuelSession): DuelView {
  const player = (p: 0 | 1): PlayerView => {
    const all = (loc: number) => (s.queryLocation(p, loc as OcgLocation, FLAGS).map(toView).filter(Boolean) as CardView[]);
    const slots = (loc: number, n: number) => {
      const raw = s.queryLocation(p, loc as OcgLocation, FLAGS);
      return Array.from({ length: n }, (_, i) => toView(raw[i] ?? null));
    };
    return {
      lp: s.lp[p],
      hand: all(OcgLocation.HAND),
      mzone: slots(OcgLocation.MZONE, 7),
      szone: slots(OcgLocation.SZONE, 8),
      grave: all(OcgLocation.GRAVE),
      removed: all(OcgLocation.REMOVED),
      extra: all(OcgLocation.EXTRA),
      deckCount: s.count(p, OcgLocation.DECK),
      extraCount: s.count(p, OcgLocation.EXTRA),
    };
  };
  const field = s.field();
  return {
    me: s.me,
    turn: s.turn,
    turnPlayer: s.turnPlayer,
    phase: s.phase,
    players: [player(0), player(1)],
    chain: field.chain.map((c: OcgChain) => ({ code: c.code, controller: c.controller, location: c.location, sequence: c.sequence, description: c.description })),
    decision: s.decision,
    result: s.result,
    steps: s.responses.length,
  };
}
