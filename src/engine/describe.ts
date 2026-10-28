// Kurze deutsche Textzeilen zu Informations-Nachrichten des Kerns (Konsole, Verlauf).
import { OcgLocation, OcgMessageType, type OcgMessage } from "ocgcore-wasm";
import { cardName, describeString, type GameData } from "./data";
import { locationName, phaseName, zoneName } from "./text";

export function describeMessage(msg: OcgMessage, data: GameData, me: 0 | 1): string | null {
  const who = (p: number) => (p === me ? "Du" : "Gegner");
  const name = (code: number) => (code ? cardName(data, code) : "verdeckte Karte");
  switch (msg.type) {
    case OcgMessageType.NEW_TURN:
      return `── Neuer Zug: ${who(msg.player)} ──`;
    case OcgMessageType.NEW_PHASE:
      return `[${phaseName(msg.phase)}]`;
    case OcgMessageType.DRAW:
      // Gegnerhand bleibt verdeckt – auch im Verlauf.
      return msg.player === me ? `Du ziehst ${msg.drawn.map((c) => name(c.code)).join(", ")}` : `Gegner zieht ${msg.drawn.length} Karte${msg.drawn.length === 1 ? "" : "n"}`;
    case OcgMessageType.SUMMONING:
      return `Normalbeschwörung: ${name(msg.code)}`;
    case OcgMessageType.SPSUMMONING:
      return `Spezialbeschwörung: ${name(msg.code)}`;
    case OcgMessageType.FLIPSUMMONING:
      return `Flippbeschwörung: ${name(msg.code)}`;
    case OcgMessageType.CHAINING:
      return `Kette: ${name(msg.code)} wird aktiviert`;
    case OcgMessageType.CHAIN_SOLVING:
      return `  löst auf: Glied ${msg.chain_size}`;
    case OcgMessageType.CHAIN_NEGATED:
    case OcgMessageType.CHAIN_DISABLED:
      return `  Glied ${msg.chain_size} wurde annulliert`;
    case OcgMessageType.MOVE: {
      const { from, to } = msg;
      if (from.location === to.location && from.controller === to.controller) return null;
      const where = (l: { location: number; sequence: number; controller: number }) =>
        (l.controller !== me ? "Gegner-" : "") + (l.location & (OcgLocation.MZONE | OcgLocation.SZONE) ? zoneName(l.location, l.sequence) : locationName(l.location));
      if (!from.location) return null; // neu erschaffene Karten (Spielmarken)
      if (from.controller !== me && from.location === OcgLocation.DECK && to.location === OcgLocation.HAND) return null; // verdeckt
      return `  ${name(msg.card)}: ${where(from)} → ${to.location ? where(to) : "aus dem Spiel"}`;
    }
    case OcgMessageType.SET:
      return msg.controller === me ? `Gesetzt: ${name(msg.code)}` : "Gegner setzt eine Karte";
    case OcgMessageType.DAMAGE:
      return `${who(msg.player)}: −${msg.amount} LP`;
    case OcgMessageType.RECOVER:
      return `${who(msg.player)}: +${msg.amount} LP`;
    case OcgMessageType.PAY_LPCOST:
      return `${who(msg.player)} zahlt ${msg.amount} LP`;
    case OcgMessageType.ATTACK:
      return `Angriff!`;
    case OcgMessageType.HINT:
      // HINT_OPSELECTED (4): Der Gegner hat eine Option gewählt
      return msg.hint_type === 4 ? `  Gewählt: ${describeString(data, msg.hint)}` : null;
    case OcgMessageType.MISSED_EFFECT:
      return `  Timing verpasst: ${name(msg.code)}`;
    case OcgMessageType.WIN:
      return `Duell beendet – ${msg.player === me ? "du gewinnst" : msg.player === 2 ? "Unentschieden" : "der Gegner gewinnt"}`;
    default:
      return null;
  }
}
