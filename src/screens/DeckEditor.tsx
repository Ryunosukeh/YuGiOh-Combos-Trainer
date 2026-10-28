// Deckbuilder. Hochformat: Suche und Deck als Reiter. Querformat: Suche links, Deck rechts.
// Beide Bereiche bleiben immer eingehängt (nur per CSS ein-/ausgeblendet) → Drehen verliert nichts.
import { useMemo, useState } from "react";
import { useApp, useDeck } from "../app/store";
import { baseId, T } from "../cards/info";
import type { CardRecord } from "../data/types";
import { toYdk } from "../deck/ydk";
import { toYdke } from "../deck/ydke";
import { allowedCount, defaultLfList, sectionFor, validateDeck } from "../deck/validate";
import { SECTION_NAMES, type Deck, type Section } from "../deck/types";
import { cardName } from "../engine/data";
import { CardImage } from "../ui/CardImage";
import { useLayout, usePress, useRememberScroll } from "../ui/hooks";
import { InputDialog, Sheet } from "../ui/Sheet";
import { CardDetail } from "./CardDetail";
import { ImportDialog } from "./ImportDialog";

export function DeckEditor({ id }: { id: string }) {
  const layout = useLayout();
  const deck = useDeck(id);
  const { tab, set, updateDeck, data, detail } = useApp();
  const [dialog, setDialog] = useState<"rename" | "export" | null>(null);
  if (!deck || !data) return <p className="page">Deck nicht gefunden.</p>;

  return (
    <div className={`editor ${layout}`}>
      <header className="topbar">
        <button className="icon-btn" onClick={() => set({ route: { screen: "decks" }, detail: null })} aria-label="Zurück zur Deckliste">←</button>
        <button className="title-btn" onClick={() => setDialog("rename")} title="Umbenennen">{deck.name}</button>
        <button className="btn small" onClick={() => set({ import: { target: { kind: "deck", id, mode: "add" }, text: "", preview: null, deckName: deck.name } })}>Import</button>
        <button className="btn small" onClick={() => setDialog("export")}>Export</button>
        <button className="btn small primary" onClick={() => set({ duelSetup: id, detail: null })} disabled={!deck.main.length}>Duell</button>
      </header>

      <nav className="tabs" role="tablist" aria-label="Bereich">
        <button role="tab" aria-selected={tab === "search"} className={tab === "search" ? "on" : ""} onClick={() => set({ tab: "search" })}>Suche</button>
        <button role="tab" aria-selected={tab === "deck"} className={tab === "deck" ? "on" : ""} onClick={() => set({ tab: "deck" })}>
          Deck <span className="muted">{deck.main.length}/{deck.extra.length}/{deck.side.length}</span>
        </button>
      </nav>

      <div className="panes">
        <section className="pane" data-active={layout === "landscape" || tab === "search"} aria-label="Suchbereich">
          <SearchPane deck={deck} />
        </section>
        <section className="pane" data-active={layout === "landscape" || tab === "deck"} aria-label="Deckbereich">
          <DeckPane deck={deck} />
        </section>
      </div>

      {detail !== null && <CardDetail deckId={id} />}
      <ImportDialog />
      {dialog === "rename" && (
        <InputDialog title="Deck umbenennen" label="Name" initial={deck.name} confirm="Speichern" onClose={() => setDialog(null)}
          onConfirm={(name) => updateDeck(id, (d) => { d.name = name; })} />
      )}
      {dialog === "export" && <ExportDialog deck={deck} onClose={() => setDialog(null)} />}
    </div>
  );
}

function SearchPane({ deck }: { deck: Deck }) {
  const { search, query, set, data, updateDeck } = useApp();
  const ref = useRememberScroll("search");
  const hits = useMemo(() => (search && query.trim().length >= 2 ? search.search(query, 60) : []), [search, query]);
  const lf = data ? defaultLfList(data) : undefined;
  if (!data) return null;
  const countOf = (c: CardRecord) => [...deck.main, ...deck.extra, ...deck.side].filter((x) => { const r = data.cards.get(x); return r && baseId(r) === c.id; }).length;

  return (
    <div className="pane-inner">
      <div className="search-box">
        <input
          type="search" inputMode="search" enterKeyHint="search" placeholder="Kartenname (deutsch oder englisch)"
          value={query} onChange={(e) => set({ query: e.target.value })} aria-label="Kartensuche"
        />
        {query && <button className="icon-btn" onClick={() => set({ query: "" })} aria-label="Suche leeren">✕</button>}
      </div>
      <div className="scroll" ref={ref}>
        {query.trim().length < 2 && <p className="hint">Mindestens 2 Zeichen eingeben. Tippfehler und fehlende Bindestriche sind kein Problem.</p>}
        {query.trim().length >= 2 && !hits.length && <p className="hint">Keine Karte gefunden.</p>}
        <ul className="result-list">
          {hits.map(({ card }) => {
            const n = countOf(card);
            const allowed = allowedCount(data, lf, card.id);
            return (
              <ResultRow key={card.id} card={card} count={n} allowed={allowed}
                onOpen={() => set({ detail: card.id })}
                onAdd={() => updateDeck(deck.id, (d) => { d[sectionFor(data, card.id)].push(card.id); })} />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ResultRow(props: { card: CardRecord; count: number; allowed: number; onOpen(): void; onAdd(): void }) {
  const { data, lang } = useApp();
  const press = usePress(props.onOpen, props.onOpen);
  const { card } = props;
  const main = cardName(data!, card.id, lang);
  const sub = lang === "de" ? (card.nameDe ? card.name : "") : card.nameDe ?? "";
  return (
    <li className="result-row">
      <button className="result-open" {...press} aria-label={`${main} anzeigen`}>
        <CardImage card={card} />
        <span className="result-text">
          <span className="result-name">{main}</span>
          {sub && <span className="muted small">{sub}</span>}
        </span>
        {props.allowed < 3 && <span className={`ban-badge ban-${props.allowed}`} title="Banliste">{props.allowed}</span>}
      </button>
      <button className="add-btn" onClick={props.onAdd} disabled={props.count >= 3} aria-label={`${main} hinzufügen`}>
        {props.count ? <span className="count-badge">{props.count}</span> : null}+
      </button>
    </li>
  );
}

/** Sortierung wie im Spiel üblich: Monster, Zauber, Fallen; innerhalb nach Name. */
function sortKey(c: CardRecord) {
  return c.type & T.MONSTER ? 0 : c.type & T.SPELL ? 1 : 2;
}

function DeckPane({ deck }: { deck: Deck }) {
  const { data, set, lang } = useApp();
  const ref = useRememberScroll("deck");
  const issues = useMemo(() => (data ? validateDeck(deck, data, defaultLfList(data)) : []), [deck, data]);
  if (!data) return null;
  const group = (list: number[]) => {
    const m = new Map<number, number>();
    for (const c of list) m.set(c, (m.get(c) ?? 0) + 1);
    return [...m].map(([code, n]) => ({ card: data.cards.get(code)!, n })).filter((x) => x.card)
      .sort((a, b) => sortKey(a.card) - sortKey(b.card) || cardName(data, a.card.id, lang).localeCompare(cardName(data, b.card.id, lang)));
  };
  return (
    <div className="pane-inner">
      <div className="scroll" ref={ref}>
        <div className={`validity ${issues.length ? "bad" : "ok"}`} role="status">
          {issues.length ? (
            <details>
              <summary>{issues.length} Problem{issues.length > 1 ? "e" : ""} – Deck nicht turnierlegal</summary>
              <ul>{issues.map((i, k) => <li key={k}>{i.text}</li>)}</ul>
            </details>
          ) : "✓ Deck ist gültig (" + (defaultLfList(data)?.name ?? "ohne Banliste") + ")"}
        </div>
        {(["main", "extra", "side"] as Section[]).map((s) => (
          <section key={s} className="deck-section">
            <h3>{SECTION_NAMES[s]} <span className="muted">{deck[s].length}</span></h3>
            {deck[s].length === 0 ? <p className="hint">Leer – Karten über die Suche hinzufügen.</p> : (
              <ul className="deck-grid">
                {group(deck[s]).map(({ card, n }) => <DeckCard key={card.id} card={card} n={n} onOpen={() => set({ detail: card.id })} />)}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function DeckCard({ card, n, onOpen }: { card: CardRecord; n: number; onOpen(): void }) {
  const { data, lang } = useApp();
  const press = usePress(onOpen, onOpen);
  return (
    <li>
      <button className="deck-card" {...press} aria-label={`${n}× ${cardName(data!, card.id, lang)}`}>
        <CardImage card={card} />
        {n > 1 && <span className="count-badge">{n}</span>}
      </button>
    </li>
  );
}

function ExportDialog({ deck, onClose }: { deck: Deck; onClose(): void }) {
  const { data, lang } = useApp();
  const [msg, setMsg] = useState("");
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setMsg(`${what} kopiert.`); } catch { setMsg("Kopieren nicht möglich – Text unten markieren."); }
  };
  const textList = useMemo(() => {
    if (!data) return "";
    const lines: string[] = [];
    for (const s of ["main", "extra", "side"] as Section[]) {
      if (!deck[s].length) continue;
      lines.push(SECTION_NAMES[s]);
      const m = new Map<number, number>();
      for (const c of deck[s]) m.set(c, (m.get(c) ?? 0) + 1);
      for (const [c, n] of m) lines.push(`${n}x ${cardName(data, c, lang)}`);
    }
    return lines.join("\n");
  }, [deck, data, lang]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([toYdk(deck)], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name.replace(/[^\p{L}\p{N} _-]/gu, "_")}.ydk`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Sheet title="Deck exportieren" onClose={onClose}>
      <div className="stack">
        <button className="btn" onClick={download}>Als .ydk-Datei speichern</button>
        <button className="btn" onClick={() => copy(toYdke(deck), "ydke-Link")}>ydke://-Link kopieren</button>
        <button className="btn" onClick={() => copy(textList, "Textliste")}>Textliste kopieren ({lang === "de" ? "deutsch" : "englisch"})</button>
        {msg && <p role="status">{msg}</p>}
        <textarea className="export-text" readOnly value={textList} rows={8} aria-label="Textliste" />
      </div>
    </Sheet>
  );
}
