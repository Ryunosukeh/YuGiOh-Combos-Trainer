// Eine Duell-Sitzung: Kern + Konfiguration + Protokoll der Nutzerantworten.
// Rückgängig = neue Sitzung mit gleichem Seed und allen Antworten bis auf die letzten n.
import {
  OcgDuelMode, OcgLocation, OcgResponseType, type OcgLocation as OcgLocationT, type OcgQueryFlags as OcgQueryFlagsT, OcgMessageType, OcgPosition, OcgProcessResult, OcgQueryFlags,
  type OcgCardData, type OcgCoreSync, type OcgDuelHandle, type OcgMessage, type OcgResponse,
} from "ocgcore-wasm";
import { toOcgCardData } from "../data/types";
import { isEmptyChainWindow, dummyResponse, type DummyBehavior } from "./autopilot";
import { cardName, type GameData } from "./data";
import { isRequest } from "./prompts";
import { createRng, expandSeed, shuffled } from "./seed";

export interface DeckList {
  main: number[];
  extra: number[];
  side?: number[];
}

export interface DuelConfig {
  deck: DeckList;
  /** Seed für Mischen/Münzwürfe; gleicher Seed + gleiche Antworten = gleiches Duell. */
  seed: number;
  goFirst: boolean;
  /** Testhand: diese Karten liegen zu Beginn auf der Hand (werden aus dem Main Deck genommen). */
  hand?: number[];
  /** Testhand zufällig auf 5 Karten auffüllen (Standard: nein, wenn eine Testhand gesetzt ist). */
  fillHand?: boolean;
  opponent?: {
    deck?: DeckList;
    hand?: number[];
    /**
     * "pass": Dummy entscheidet alles selbst. "ask": Du entscheidest für den Gegner, ob er antwortet (Kettenfenster,
     * optionale Effekte) und alles innerhalb einer Kette, an der er beteiligt ist (Ziele, Kosten …).
     * Zugsteuerung, Setzen, Zonen und Handlimit außerhalb von Ketten bleiben beim Dummy.
     */
    mode?: "pass" | "ask";
    /** "passive" (Standard): tut nichts. "set": setzt pro Zug ein Monster und Zauber/Fallen, aktiviert nie. */
    behavior?: DummyBehavior;
  };
  /** Leere Antwortfenster automatisch passen (Standard: ja). */
  autoPassEmpty?: boolean;
  /**
   * Antwortfenster mit Optionen: "auto" (Standard) fragt nur, wenn der Kern passende Auslöser bzw.
   * Schnelleffekte meldet (spe_count > 0, wie EDOPro) und das letzte Kettenglied nicht dein eigenes ist
   * (keine Ash auf die eigene Suche). "all" fragt bei jeder Möglichkeit.
   */
  chainPrompts?: "auto" | "all";
  startingLP?: number;
}

/** Eine offene Entscheidung, die der Nutzer treffen muss. */
export interface Decision {
  msg: OcgMessage;
  /** Absoluter Spielerindex des Entscheidenden. */
  player: 0 | 1;
  forOpponent: boolean;
  /** Letzter Auswahl-Hinweis des Kerns für diesen Spieler. */
  hint?: bigint;
}

/** Normales Monster als Füllmaterial für den Dummy-Gegner (Blue-Eyes White Dragon). */
export const DUMMY_FILLER = 89631139;
const HINT_SELECTMSG = 3;

export class DuelSession {
  readonly me: 0 | 1;
  /** Alle Nachrichten des Kerns seit Duellbeginn. */
  readonly history: OcgMessage[] = [];
  /** Alle vom Nutzer getroffenen Entscheidungen (Grundlage für Rückgängig/Wiederholen). */
  readonly responses: OcgResponse[] = [];
  decision: Decision | null = null;
  result: { winner: number; reason: number } | null = null;
  /** Lebenspunkte beider Spieler (absoluter Index), aus den Nachrichten mitgeführt. */
  readonly lp: [number, number];
  /** Zugnummer (1 = erster Zug), Spieler am Zug, aktuelle Phase (OcgPhase). */
  turn = 0;
  turnPlayer: 0 | 1 = 0;
  /** Spieler der Glieder der aktuell entstehenden Kette (für „nicht auf eigene Effekte antworten“). */
  private chainOwners: (0 | 1)[] = [];
  /** Gegner aktiviert gerade (Kosten/Ziele vor CHAINED) – diese Entscheidungen trifft im Modus „ask“ der Nutzer. */
  private oppActivating = false;
  phase = 0;
  /** Skripte, die der Kern angefragt hat, die es aber nicht gibt (Diagnose). */
  readonly missingScripts = new Set<string>();

  private readonly handle: OcgDuelHandle;
  private readonly hints: (bigint | undefined)[] = [undefined, undefined];
  private replayQueue: OcgResponse[] = [];
  private readonly cardCache = new Map<number, OcgCardData>();

  private constructor(private readonly core: OcgCoreSync, readonly data: GameData, readonly config: DuelConfig) {
    this.me = config.goFirst ? 0 : 1;
    this.lp = [config.startingLP ?? 8000, config.startingLP ?? 8000];
    const opp = (1 - this.me) as 0 | 1;
    const myHand = config.hand ?? [];
    const oppHand = config.opponent?.hand ?? [];
    const main = removeFromDeck(config.deck.main, myHand, data);
    const oppDeck = config.opponent?.deck ?? { main: Array(40).fill(DUMMY_FILLER), extra: [] };
    const myDraw = myHand.length && !config.fillHand ? 0 : Math.max(0, 5 - myHand.length);
    const oppDraw = Math.max(0, 5 - oppHand.length);
    const lp = config.startingLP ?? 8000;
    const team = (draw: number) => ({ drawCountPerTurn: 1, startingDrawCount: draw, startingLP: lp });

    const handle = core.createDuel({
      flags: OcgDuelMode.MODE_MR5,
      seed: expandSeed(config.seed),
      team1: team(this.me === 0 ? myDraw : oppDraw),
      team2: team(this.me === 1 ? myDraw : oppDraw),
      cardReader: (code) => {
        let c = this.cardCache.get(code);
        if (!c) {
          const rec = data.cards.get(code);
          if (!rec) return null;
          this.cardCache.set(code, (c = toOcgCardData(rec)));
        }
        return c;
      },
      scriptReader: (name) => {
        const s = data.scripts.read(name);
        if (s === null) {
          this.missingScripts.add(name);
          return "";
        }
        return s;
      },
      errorHandler: (_type, text) => {
        // Lua-Fehler aus Kartenskripten sichtbar machen statt zu verschlucken.
        console.warn(`[ocgcore] ${text}`);
      },
    });
    if (!handle) throw new Error("Duell konnte nicht erstellt werden");
    this.handle = handle;

    for (const s of ["constant.lua", "utility.lua"]) {
      const src = data.scripts.read(s);
      if (!src) throw new Error(`Grundskript ${s} fehlt im Datenpaket`);
      core.loadScript(handle, s, src);
    }
    const add = (player: 0 | 1, codes: number[], location: OcgLocationT) => {
      for (const code of codes) {
        if (!data.cards.has(code)) throw new Error(`Unbekannte Karte ${code}`);
        core.duelNewCard(handle, {
          code, team: player, duelist: 0, controller: player, location, sequence: 0,
          position: location === OcgLocation.HAND ? OcgPosition.FACEDOWN_ATTACK : OcgPosition.FACEDOWN_DEFENSE,
        });
      }
    };
    // Der Kern mischt beim Start nicht – das ist Aufgabe des Hosts (wie beim EDOPro-Server).
    const rng = createRng(config.seed);
    add(this.me, shuffled(main, rng), OcgLocation.DECK);
    add(this.me, config.deck.extra, OcgLocation.EXTRA);
    add(this.me, myHand, OcgLocation.HAND);
    add(opp, shuffled(removeFromDeck(oppDeck.main, oppHand, data, true), rng), OcgLocation.DECK);
    add(opp, oppDeck.extra, OcgLocation.EXTRA);
    add(opp, oppHand, OcgLocation.HAND);
    core.startDuel(handle);
  }

  /** Neues Duell starten; optional sofort eine Antwortliste einspielen (Neuabspielen). */
  static start(core: OcgCoreSync, data: GameData, config: DuelConfig, replay: OcgResponse[] = []): DuelSession {
    const s = new DuelSession(core, data, config);
    s.replayQueue = [...replay];
    s.drive(null);
    if (s.replayQueue.length) throw new Error(`Neuabspielen: ${s.replayQueue.length} Antwort(en) übrig – Duell endete früher`);
    return s;
  }

  /**
   * Nutzerentscheidung senden. Gibt `false` zurück, wenn der Kern sie als ungültig ablehnt
   * (die Entscheidung bleibt dann offen).
   */
  respond(r: OcgResponse): boolean {
    if (!this.decision) throw new Error("Keine offene Entscheidung");
    this.core.duelSetResponse(this.handle, r);
    const status = this.core.duelProcess(this.handle);
    const msgs = this.core.duelGetMessage(this.handle);
    if (msgs[0]?.type === OcgMessageType.RETRY) return false;
    this.noteResponse(this.decision, r);
    this.responses.push(r);
    this.decision = null;
    this.drive({ status, msgs });
    return true;
  }

  /** Die letzten `n` Entscheidungen zurücknehmen. Liefert eine neue Sitzung; diese hier wird zerstört. */
  undo(n = 1): DuelSession {
    const keep = this.responses.slice(0, Math.max(0, this.responses.length - n));
    this.destroy();
    return DuelSession.start(this.core, this.data, this.config, keep);
  }

  destroy() {
    this.core.destroyDuel(this.handle);
  }

  /** Index in `history`, ab dem die Nachrichten der letzten Antwort beginnen (für Protokoll/Animation). */
  lastBatchStart = 0;

  private drive(first: { status: OcgProcessResult; msgs: OcgMessage[] } | null) {
    this.lastBatchStart = this.history.length;
    let batch = first;
    for (;;) {
      if (!batch) {
        const status = this.core.duelProcess(this.handle);
        batch = { status, msgs: this.core.duelGetMessage(this.handle) };
        if (batch.msgs[0]?.type === OcgMessageType.RETRY)
          throw new Error("Der Kern hat eine automatische Antwort abgelehnt (RETRY) – Protokoll passt nicht zum Duell");
      }
      const { status, msgs } = batch;
      batch = null;
      for (const m of msgs) {
        this.history.push(m);
        if (m.type === OcgMessageType.HINT && m.hint_type === HINT_SELECTMSG) this.hints[m.player] = m.hint;
        if (m.type === OcgMessageType.WIN) this.result = { winner: m.player, reason: m.reason };
        else if (m.type === OcgMessageType.LPUPDATE) this.lp[m.player] = m.lp;
        else if (m.type === OcgMessageType.DAMAGE || m.type === OcgMessageType.PAY_LPCOST) this.lp[m.player] = Math.max(0, this.lp[m.player] - m.amount);
        else if (m.type === OcgMessageType.RECOVER) this.lp[m.player] += m.amount;
        else if (m.type === OcgMessageType.NEW_TURN) { this.turn++; this.turnPlayer = m.player as 0 | 1; }
        else if (m.type === OcgMessageType.NEW_PHASE) this.phase = m.phase;
        else if (m.type === OcgMessageType.CHAINING) this.chainOwners.push(m.controller);
        else if (m.type === OcgMessageType.CHAINED) this.oppActivating = false;
        else if (m.type === OcgMessageType.CHAIN_END) { this.chainOwners = []; this.oppActivating = false; }
      }
      if (status === OcgProcessResult.END || this.result) return;
      if (status === OcgProcessResult.CONTINUE) continue;

      const req = msgs[msgs.length - 1];
      if (!req || !isRequest(req)) throw new Error(`Kern wartet, aber letzte Nachricht ist keine Anfrage (${req?.type})`);
      const player = (req as { player: number }).player as 0 | 1;
      const decision: Decision = { msg: req, player, forOpponent: player !== this.me, hint: this.hints[player] };

      const auto = this.autoResponse(decision);
      if (auto) {
        this.core.duelSetResponse(this.handle, auto);
        continue;
      }
      const replay = this.replayQueue.shift();
      if (replay) {
        this.noteResponse(decision, replay);
        this.core.duelSetResponse(this.handle, replay);
        this.responses.push(replay);
        const status2 = this.core.duelProcess(this.handle);
        const msgs2 = this.core.duelGetMessage(this.handle);
        if (msgs2[0]?.type === OcgMessageType.RETRY)
          throw new Error(`Neuabspielen: Antwort ${this.responses.length} wurde vom Kern abgelehnt`);
        batch = { status: status2, msgs: msgs2 };
        continue;
      }
      this.decision = decision;
      return;
    }
  }

  /** Merkt sich, ob der Nutzer für den Gegner gerade etwas aktiviert (Folgefragen gehen dann an den Nutzer). */
  private noteResponse(d: Decision, r: OcgResponse) {
    if (!d.forOpponent) return;
    if (r.type === OcgResponseType.SELECT_CHAIN && r.index !== null) this.oppActivating = true;
    if (r.type === OcgResponseType.SELECT_EFFECTYN && r.yes) this.oppActivating = true;
  }

  private autoResponse(d: Decision): OcgResponse | null {
    if (isEmptyChainWindow(d.msg) && this.config.autoPassEmpty !== false) return dummyResponse(d.msg, this.data);
    if (d.msg.type === OcgMessageType.SELECT_CHAIN && !d.msg.forced && this.config.chainPrompts !== "all") {
      const ownLastLink = this.chainOwners.at(-1) === d.player;
      if (d.msg.spe_count === 0 || ownLastLink) return { type: OcgResponseType.SELECT_CHAIN, index: null };
    }
    if (!d.forOpponent) return null;
    if (this.config.opponent?.mode === "ask") {
      const m = d.msg;
      // Antworten (Handtraps, optionale Effekte) entscheidet der Nutzer – Pflicht-Kette mit nur einer Wahl nicht.
      if (m.type === OcgMessageType.SELECT_CHAIN && !(m.forced && m.selects.length === 1)) return null;
      if (m.type === OcgMessageType.SELECT_EFFECTYN) return null;
      // Alles innerhalb einer Kette mit Gegner-Beteiligung (Ziele, Kosten, Auflösung) ebenso.
      const t = m.type;
      const control = t === OcgMessageType.SELECT_IDLECMD || t === OcgMessageType.SELECT_BATTLECMD;
      if (!control && (this.oppActivating || this.chainOwners.includes(d.player))) return null;
    }
    return dummyResponse(d.msg, this.data, this.config.opponent?.behavior);
  }

  // ---------- Feldabfragen ----------
  count(player: 0 | 1, location: OcgLocationT) {
    return this.core.duelQueryCount(this.handle, player, location);
  }

  cards(player: 0 | 1, location: OcgLocationT) {
    const flags = (OcgQueryFlags.CODE | OcgQueryFlags.POSITION | OcgQueryFlags.ATTACK | OcgQueryFlags.DEFENSE | OcgQueryFlags.LEVEL | OcgQueryFlags.RANK | OcgQueryFlags.LINK) as OcgQueryFlagsT;
    return this.core.duelQueryLocation(this.handle, { controller: player, location, flags });
  }

  /** Alle Karten eines Ortes mit frei wählbaren Abfrage-Flags (leere Zonen = null). */
  queryLocation(player: 0 | 1, location: OcgLocationT, flags: OcgQueryFlagsT) {
    return this.core.duelQueryLocation(this.handle, { controller: player, location, flags });
  }

  field() {
    return this.core.duelQueryField(this.handle);
  }

  name(code: number) {
    return cardName(this.data, code);
  }
}

/** Testhand-Karten aus dem Deck entfernen (je Karte ein Exemplar). */
function removeFromDeck(deck: number[], hand: number[], data: GameData, lenient = false): number[] {
  const rest = [...deck];
  for (const code of hand) {
    const i = rest.indexOf(code);
    if (i >= 0) rest.splice(i, 1);
    else if (!lenient) throw new Error(`Testhand: „${cardName(data, code)}“ ist nicht (mehr) im Main Deck`);
  }
  return rest;
}
