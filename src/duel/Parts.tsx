// Hand-Leiste, Stapelansicht, Aktionsmenü einer Karte, Kettenanzeige und Verlauf.
import { useEffect, useMemo, useRef, useState } from "react";
import { comboLog, comboLogText } from "../engine/combolog";
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
  const opp = (1 - view.me) as 0 | 1;
  const oppCount = view.players[opp].hand.length;
  // Wer für den Gegner antwortet, muss dessen Hand kennen → antippbar. Sonst bleibt sie verdeckt.
  const askOpp = useDuel((s) => s.config?.opponent?.mode === "ask");
  const setUi = useDuel((s) => s.setUi);
  return (
    <div className="hand" aria-label={`Deine Hand: ${hand.length} Karten`}>
      {hand.length === 0 && <span className="muted small hand-empty">Keine Karten auf der Hand</span>}
      {hand.map((c, i) => <HandCard key={i} card={c} k={`${view.me}-${OcgLocation.HAND}-${i}`} actions={actions} />)}
      {askOpp ? (
        <button className="opp-hand btn small" onClick={() => setUi({ pile: { player: opp, location: OcgLocation.HAND } })} aria-label={`Gegnerhand ansehen (${oppCount} Karten)`}>
          Gegner: {oppCount} 🂠
        </button>
      ) : (
        <span className="opp-hand muted small" aria-label={`Gegner hat ${oppCount} Karten auf der Hand`}>
          Gegner: {oppCount} 🂠
        </span>
      )}
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
  const list = pile.location === OcgLocation.GRAVE ? p.grave : pile.location === OcgLocation.REMOVED ? p.removed : pile.location === OcgLocation.EXTRA ? p.extra : pile.location === OcgLocation.HAND ? p.hand : [];
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
              <DuelCard card={{ ...c, position: mine || c.position & 0x5 || pile.location === OcgLocation.HAND ? 1 : c.position }} hidden={!mine && !(c.position & 0x5) && pile.location === OcgLocation.EXTRA} />
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

/** Combo-Protokoll (kompakt, kopierbar) mit Umschalter auf den ausführlichen Verlauf. */
export function ProtocolView() {
  const { log, view } = useDuel();
  const data = useApp((s) => s.data);
  const [details, setDetails] = useState(false);
  const [copied, setCopied] = useState("");
  const [manual, setManual] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (data && view ? comboLog(log, data, view.me) : []), [log, data, view]);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [lines.length, details]);
  if (!data || !view) return null;
  const copy = async () => {
    const text = comboLogText(lines);
    try { await navigator.clipboard.writeText(text); setCopied("Kopiert ✓"); setManual(null); }
    catch { setCopied("Bitte manuell kopieren"); setManual(text); } // Zwischenablage gesperrt → Text markiert anzeigen
    setTimeout(() => setCopied(""), 2000);
  };
  let n = 0;
  return (
    <section className="protocol" aria-label="Combo-Protokoll">
      <div className="protocol-head">
        <button className="btn small" onClick={copy}>{copied || "Kopieren"}</button>
        <button className="btn small" aria-pressed={details} onClick={() => setDetails((d) => !d)}>{details ? "Kompakt" : "Details"}</button>
      </div>
      {manual !== null && (
        <textarea className="export-text" readOnly value={manual} rows={6} aria-label="Protokolltext" ref={(el) => el?.select()} onBlur={() => setManual(null)} />
      )}
      <div className="protocol-body" ref={ref}>
        {details ? <LogView /> : (
          <ol className="combo-list">
            {lines.map((l, i) => {
              if (l.kind === "turn") n = 0;
              return (
                <li key={i} className={`${l.kind} ${l.player === view.me ? "" : "opp"}`}>
                  {l.kind === "action" ? <><span className="step-no">{++n}.</span> {l.text}</> : l.text}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
