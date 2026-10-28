// Spielfeld wie am Tisch: Gegner oben (gespiegelt), du unten, Extra Monster Zonen in der Mitte.
// Spalten: 0 = Feldzone/Extra Deck bzw. Friedhof/Deck des Gegners, 1–5 = Zonen, 6 = Friedhof/Deck bzw. Gegner-Feldzone.
import { useEffect, useRef, type ReactNode } from "react";
import { OcgLocation } from "ocgcore-wasm";
import { useApp } from "../app/store";
import { useDuel } from "../app/duel";
import { cardName } from "../engine/data";
import type { CardView, DuelView } from "../engine/view";
import { usePress } from "../ui/hooks";
import type { FieldActions } from "./actions";
import { DuelCard } from "./DuelCard";

const M = OcgLocation.MZONE, S = OcgLocation.SZONE;

export function Field({ view, actions }: { view: DuelView; actions: FieldActions }) {
  const ref = useRef<HTMLDivElement>(null);
  useCardSize(ref);
  const me = view.me, opp = (1 - me) as 0 | 1;
  const P = view.players;
  const zone = (player: 0 | 1, loc: number, seq: number, card: CardView | null | undefined, label: string) => (
    <Zone key={`${player}-${loc}-${seq}`} player={player} loc={loc} seq={seq} card={card ?? null} label={label} mine={player === me} actions={actions} />
  );
  // Gegner: Sequenz i (aus seiner Sicht links→rechts) steht bei uns in Spalte 5 - i.
  const oppRow = (loc: number, list: (CardView | null)[], label: string) =>
    [4, 3, 2, 1, 0].map((i) => zone(opp, loc, i, list[i], `${label} ${i + 1}`));
  const myRow = (loc: number, list: (CardView | null)[], label: string) => [0, 1, 2, 3, 4].map((i) => zone(me, loc, i, list[i], `${label} ${i + 1}`));

  // Extra Monster Zonen: links (Spalte 2) = meine 5 bzw. Gegner 6; rechts (Spalte 4) = meine 6 bzw. Gegner 5.
  const emz = (mySeq: 5 | 6, oppSeq: 5 | 6) =>
    P[opp].mzone[oppSeq] ? zone(opp, M, oppSeq, P[opp].mzone[oppSeq], "Extra Monster Zone (Gegner)") : zone(me, M, mySeq, P[me].mzone[mySeq], "Extra Monster Zone");

  return (
    <div className="board" ref={ref} aria-label="Spielfeld">
      <div className="field-grid">
        {/* Gegner hinten: Deck, Z/F 5..1, Extra */}
        <Pile player={opp} location={OcgLocation.DECK} label="Deck (Gegner)" count={P[opp].deckCount} />
        {oppRow(S, P[opp].szone, "Gegner Z/F")}
        <Pile player={opp} location={OcgLocation.EXTRA} label="Extra Deck (Gegner)" count={P[opp].extraCount} />
        {/* Gegner vorne: Friedhof, M 5..1, Feldzone */}
        <Pile player={opp} location={OcgLocation.GRAVE} label="Friedhof (Gegner)" count={P[opp].grave.length} top={P[opp].grave.at(-1)} />
        {oppRow(M, P[opp].mzone, "Gegner Monster")}
        {zone(opp, S, 5, P[opp].szone[5], "Feldzone (Gegner)")}
        {/* Mitte */}
        <Pile player={opp} location={OcgLocation.REMOVED} label="Verbannt (Gegner)" count={P[opp].removed.length} top={P[opp].removed.at(-1)} />
        <div className="cell spacer" />
        {emz(5, 6)}
        <div className="cell spacer" />
        {emz(6, 5)}
        <div className="cell spacer" />
        <Pile player={me} location={OcgLocation.REMOVED} label="Verbannt" count={P[me].removed.length} top={P[me].removed.at(-1)} />
        {/* Ich vorne: Feldzone, M 1..5, Friedhof */}
        {zone(me, S, 5, P[me].szone[5], "Feldzone")}
        {myRow(M, P[me].mzone, "Monsterzone")}
        <Pile player={me} location={OcgLocation.GRAVE} label="Friedhof" count={P[me].grave.length} top={P[me].grave.at(-1)} actions={actions} />
        {/* Ich hinten: Extra, Z/F 1..5, Deck */}
        <Pile player={me} location={OcgLocation.EXTRA} label="Extra Deck" count={P[me].extraCount} actions={actions} />
        {myRow(S, P[me].szone, "Zauber-/Fallenzone")}
        <Pile player={me} location={OcgLocation.DECK} label="Deck" count={P[me].deckCount} actions={actions} />
      </div>
    </div>
  );
}

/** Kartengröße aus dem verfügbaren Platz berechnen (7 Spalten, 5 Reihen). */
function useCardSize(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const gap = 4;
      // contentRect = ohne Innenabstand, sonst ragt das Feld über den Rand
      const w = (entry.contentRect.width - gap * 6) / 7;
      const h = (entry.contentRect.height - gap * 4) / 5 / 1.46;
      // Auf dem Duell-Container setzen, damit auch die Hand-Leiste die Kartengröße kennt.
      (el.closest<HTMLElement>(".duel") ?? el).style.setProperty("--cw", `${Math.max(24, Math.floor(Math.min(w, h)))}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

function Zone(props: { player: 0 | 1; loc: number; seq: number; card: CardView | null; label: string; mine: boolean; actions: FieldActions }) {
  const { set, data } = useApp();
  const { setUi, respond } = useDuel();
  const key = `${props.player}-${props.loc}-${props.seq}`;
  const visible = props.card && (props.mine || props.card.position & 0x5) && props.card.code;
  const what = props.card ? (visible && data ? cardName(data, props.card.code) : "verdeckte Karte") : "leer";
  const opts = props.actions.byCard.get(key);
  const place = props.actions.zones.get(key);
  const press = usePress(
    () => { if (place) respond(place); else if (opts) setUi({ cardMenu: key }); else if (props.card?.code) set({ detail: props.card.code }); },
    () => { if (props.card?.code) set({ detail: props.card.code }); },
  );
  const cls = ["cell", "zone", props.loc === M ? "mzone" : "szone", opts ? "can-act" : "", place ? "can-place" : "", props.mine ? "" : "opp"].join(" ");
  return (
    <button className={cls} {...press} aria-label={`${props.label}: ${what}${opts ? " – Aktionen" : ""}${place ? " – hier platzieren" : ""}`}>
      {props.card && <DuelCard card={props.card} hidden={!props.mine && !(props.card.position & 0x5)} />}
      {props.card?.overlays && <span className="badge overlay">{props.card.overlays.length}</span>}
    </button>
  );
}

function Pile(props: { player: 0 | 1; location: number; label: string; count: number; top?: CardView; actions?: FieldActions }) {
  const { setUi } = useDuel();
  const hasActions = props.actions && [...props.actions.byCard.keys()].some((k) => k.startsWith(`${props.player}-${props.location}-`));
  const faceDown = props.location === OcgLocation.DECK || props.location === OcgLocation.EXTRA;
  const open = () => props.location !== OcgLocation.DECK || hasActions ? setUi({ pile: { player: props.player, location: props.location } }) : undefined;
  return (
    <button className={`cell pile ${hasActions ? "can-act" : ""}`} onClick={open} aria-label={`${props.label}: ${props.count} ${props.count === 1 ? "Karte" : "Karten"}${hasActions ? " – Aktionen" : ""}`}>
      {props.count > 0 && (faceDown ? <span className="card-back" /> : props.top ? <DuelCard card={props.top} noStats /> : null)}
      <span className="pile-count">{props.count}</span>
      <span className="pile-label">{shortLabel(props.location)}</span>
    </button>
  );
}

const shortLabel = (loc: number): ReactNode =>
  loc === OcgLocation.GRAVE ? "FH" : loc === OcgLocation.REMOVED ? "Verb." : loc === OcgLocation.EXTRA ? "Extra" : "Deck";

