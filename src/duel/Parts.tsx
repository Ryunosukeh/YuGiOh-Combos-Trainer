// Hand-Leiste, Stapelansicht, Aktionsmenü einer Karte, Kettenanzeige und Verlauf.
import { useEffect, useMemo, useRef } from "react";
import { OcgLocation } from "ocgcore-wasm";
import { useApp } from "../app/store";
import { useDuel } from "../app/duel";
import { cardName, describeString } from "../engine/data";
import { describeMessage } from "../engine/describe";
import type { MenuOption } from "../engine/prompts";
import type { CardView, DuelView } from "../engine/view";
import { locationName } from "../engine/text";
import { usePress } from "../ui/hooks";
import { Sheet } from "../ui/Sheet";
import type { FieldActions } from "./actions";
import { DuelCard } from "./DuelCard";

export function HandBar({ view, actions }: { view: DuelView; actions: FieldActions }) {
  const hand = view.players[view.me].hand;
  return (
    <div className="hand" aria-label={`Deine Hand: ${hand.length} Karten`}>
      {hand.length === 0 && <span className="muted small hand-empty">Keine Karten auf der Hand</span>}
      {hand.map((c, i) => <HandCard key={i} card={c} k={`${view.me}-${OcgLocation.HAND}-${i}`} actions={actions} />)}
      <span className="opp-hand muted small" aria-label={`Gegner hat ${view.players[1 - view.me].hand.length} Karten auf der Hand`}>
        Gegner: {view.players[1 - view.me].hand.length} 🂠
      </span>
    </div>
  );
}

function HandCard({ card, k, actions }: { card: CardView; k: string; actions: FieldActions }) {
  const { set, data } = useApp();
  const { setUi } = useDuel();
  const opts = actions.byCard.get(k);
  const press = usePress(() => (opts ? setUi({ cardMenu: k }) : set({ detail: card.code })), () => set({ detail: card.code }));
  return (
    <button className={`hand-card ${opts ? "can-act" : ""}`} {...press} aria-label={`${data ? cardName(data, card.code) : card.code}${opts ? " – Aktionen" : ""}`}>
      <DuelCard card={{ ...card, position: 1 }} />
    </button>
  );
}

/** Aktionen einer angetippten Karte (Main/Battle Phase). */
export function CardMenu({ actions }: { actions: FieldActions }) {
  const { cardMenu, setUi, respond } = useDuel();
  const { data, set } = useApp();
  if (!cardMenu || !data) return null;
  const opts = actions.byCard.get(cardMenu);
  if (!opts) return null;
  const code = opts[0].card!.code;
  return (
    <Sheet title={cardName(data, code)} onClose={() => setUi({ cardMenu: null })}>
      <div className="stack">
        {opts.map((o, i) => <button key={i} className={`btn action ${o.tag ?? ""}`} onClick={() => respond(o.response)}>{actionLabel(o)}</button>)}
        <button className="btn" onClick={() => { setUi({ cardMenu: null }); set({ detail: code }); }}>Karte ansehen</button>
      </div>
    </Sheet>
  );
}

/** Aktionsbeschriftung ohne den (im Titel schon stehenden) Kartennamen. */
function actionLabel(o: MenuOption) {
  const m = /^([^:]+):\s*[^–]+?(?:\s+–\s+(.+))?$/.exec(o.label);
  if (!m) return o.label;
  return m[2] ? `${m[1]}: ${m[2]}` : m[1];
}

/** Friedhof, Verbannt, Extra Deck (und Deck, falls Aktionen) als Liste; Karten mit Aktionen hervorgehoben. */
export function PileViewer({ view, actions }: { view: DuelView; actions: FieldActions }) {
  const { pile, setUi } = useDuel();
  const { data, set } = useApp();
  if (!pile || !data) return null;
  const p = view.players[pile.player];
  const list = pile.location === OcgLocation.GRAVE ? p.grave : pile.location === OcgLocation.REMOVED ? p.removed : pile.location === OcgLocation.EXTRA ? p.extra : [];
  const mine = pile.player === view.me;
  // Aktionen in diesem Stapel (Sequenz = Index im Stapel)
  const acts = [...actions.byCard.entries()].filter(([k]) => k.startsWith(`${pile.player}-${pile.location}-`));
  const title = `${locationName(pile.location)}${mine ? "" : " (Gegner)"} – ${pile.location === OcgLocation.DECK ? p.deckCount : list.length}`;
  return (
    <Sheet title={title} onClose={() => setUi({ pile: null })} wide>
      {acts.length > 0 && (
        <div className="stack pile-actions">
          <p className="muted small">Mögliche Aktionen:</p>
          {acts.flatMap(([, opts]) => opts).map((o, i) => (
            <button key={i} className="btn action" onClick={() => { setUi({ pile: null }); useDuel.getState().respond(o.response); }}>{o.label}</button>
          ))}
        </div>
      )}
      {list.length === 0 && pile.location !== OcgLocation.DECK && <p className="hint">Leer.</p>}
      <ul className="pile-grid">
        {[...list].reverse().map((c, i) => (
          <li key={i}>
            <button className="pile-card" onClick={() => c.code && set({ detail: c.code })} aria-label={c.code ? cardName(data, c.code) : "verdeckt"}>
              <DuelCard card={{ ...c, position: mine || c.position & 0x5 ? 1 : c.position }} hidden={!mine && !(c.position & 0x5) && pile.location === OcgLocation.EXTRA} />
              <span className="small">{c.code ? cardName(data, c.code) : "?"}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Aktuelle Kette: Glied 1 zuerst; aufgelöst wird rückwärts. */
export function ChainView({ view }: { view: DuelView }) {
  const data = useApp((s) => s.data);
  if (!data || view.chain.length === 0) return null;
  return (
    <section className="chain" aria-label="Kette">
      <h3>Kette ({view.chain.length}) <span className="muted small">löst rückwärts auf</span></h3>
      <ol>
        {view.chain.map((c, i) => (
          <li key={i} className={c.controller === view.me ? "" : "opp"}>
            <span className="link-no">{i + 1}</span>
            <span>{cardName(data, c.code)}{c.description ? <span className="muted small"> – {describeString(data, c.description)}</span> : null}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Verlauf als Textzeilen (wird in Schritt 5 zum kompakten Combo-Protokoll). */
export function LogView() {
  const { log, view } = useDuel();
  const data = useApp((s) => s.data);
  const ref = useRef<HTMLOListElement>(null);
  const lines = useMemo(() => (data && view ? log.map((m) => describeMessage(m, data, view.me)).filter((l): l is string => !!l).slice(-300) : []), [log, data, view]);
  useEffect(() => { ref.current?.lastElementChild?.scrollIntoView({ block: "end" }); }, [lines.length]);
  return (
    <ol className="log-list" ref={ref} aria-label="Verlauf">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ol>
  );
}
