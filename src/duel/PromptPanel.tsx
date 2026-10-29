// Auswahlfenster für jede Anfrage des Kerns, die nicht direkt auf dem Feld getroffen wird.
// Hochformat: Bottom Sheet. Querformat: Seitenpanel. Einklappbar („Feld ansehen“).
import { useMemo, useState } from "react";
import { OcgMessageType } from "ocgcore-wasm";
import { useApp } from "../app/store";
import { useDuel } from "../app/duel";
import { cardName } from "../engine/data";
import { buildPrompt, type CardRef, type Prompt } from "../engine/prompts";
import type { Decision } from "../engine/session";
import { nameKey } from "../cards/search";
import { CardImage } from "../ui/CardImage";
import { useLayout } from "../ui/hooks";

export function PromptPanel({ decision }: { decision: Decision }) {
  const { data, set } = useApp();
  const { minimized, setUi, respond, busy, rejected, log, undoAction, view } = useDuel();
  const layout = useLayout();
  const prompt = useMemo(() => (data ? buildPrompt(decision.msg, { data, hint: decision.hint }) : null), [decision, data]);
  if (!prompt || !data) return null;
  const opp = decision.forOpponent;
  const who = opp ? "Gegner: " : "";

  if (minimized)
    return (
      <button className={`prompt-pill ${opp ? "for-opp" : ""}`} onClick={() => setUi({ minimized: false })}>
        {who}{prompt.title} – Auswahl öffnen
      </button>
    );

  return (
    <section className={`prompt ${layout} ${opp ? "for-opp" : ""}`} role="dialog" aria-label={`${who}${prompt.title}`}>
      <header className="sheet-head">
        <h2>{who}{prompt.title}</h2>
        <button className="btn small" onClick={() => undoAction()} disabled={busy || !view?.steps} aria-label="Aktion abbrechen und rückgängig" title="Ganze Aktion zurücknehmen">↶</button>
        <button className="btn small" onClick={() => setUi({ minimized: true })}>Feld ansehen</button>
      </header>
      {opp && <p className="opp-banner small">Du entscheidest für den Gegner{decision.msg.type === OcgMessageType.SELECT_CHAIN ? " – antwortet er?" : ""}</p>}
      {rejected && <p className="error small prompt-error" role="alert">Der Regelkern hat diese Auswahl abgelehnt – bitte anders wählen.</p>}
      <div className="sheet-body">
        {/* Neuer Schlüssel je Entscheidung → keine Auswahl von der vorherigen Anfrage übrig */}
        <PromptBody key={log.length} prompt={prompt} disabled={busy} onRespond={respond} onDetail={(code) => set({ detail: code })} />
      </div>
    </section>
  );
}

function PromptBody({ prompt, disabled, onRespond, onDetail }: { prompt: Prompt; disabled: boolean; onRespond: (r: Parameters<ReturnType<typeof useDuel.getState>["respond"]>[0]) => void; onDetail(code: number): void }) {
  switch (prompt.kind) {
    case "menu":
      return (
        <div className="stack">
          {prompt.options.map((o, i) => (
            <button key={i} className={`btn action ${o.tag ?? ""}`} disabled={disabled} onClick={() => onRespond(o.response)}>
              {o.card ? <CardThumb card={o.card} /> : null}<span>{o.label}</span>
            </button>
          ))}
        </div>
      );
    case "select":
      return <SelectBody prompt={prompt} disabled={disabled} onRespond={onRespond} onDetail={onDetail} />;
    case "sort":
      return <SortBody prompt={prompt} disabled={disabled} onRespond={onRespond} />;
    case "counter":
      return <CounterBody prompt={prompt} disabled={disabled} onRespond={onRespond} />;
    case "announce-card":
      return <AnnounceBody prompt={prompt} disabled={disabled} onRespond={onRespond} />;
  }
}

function CardThumb({ card }: { card: CardRef }) {
  const data = useApp((s) => s.data);
  const rec = data?.cards.get(card.code);
  return rec ? <span className="thumb" aria-hidden="true"><CardImage card={rec} /></span> : null;
}

type R = (r: Parameters<ReturnType<typeof useDuel.getState>["respond"]>[0]) => void;

function SelectBody({ prompt, disabled, onRespond, onDetail }: { prompt: Extract<Prompt, { kind: "select" }>; disabled: boolean; onRespond: R; onDetail(code: number): void }) {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : prompt.max === 1 ? [i] : s.length < prompt.max ? [...s, i] : s));
  const ok = prompt.validate(sel);
  return (
    <div className="stack">
      <ul className="select-grid">
        {prompt.items.map((it, i) => (
          <li key={i}>
            <button className={`select-item ${sel.includes(i) ? "on" : ""}`} aria-pressed={sel.includes(i)} onClick={() => toggle(i)}
              onContextMenu={(e) => { e.preventDefault(); if (it.card) onDetail(it.card.code); }}>
              {it.card ? <CardThumb card={it.card} /> : null}
              <span className="small">{it.label}</span>
              {sel.includes(i) && prompt.max > 1 && <span className="count-badge">{sel.indexOf(i) + 1}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="row-actions sticky-actions">
        {prompt.cancel && <button className="btn" disabled={disabled} onClick={() => onRespond(prompt.cancel!)}>Abbrechen</button>}
        <button className="btn primary" disabled={disabled || !ok} onClick={() => onRespond(prompt.build(sel))}>
          Bestätigen ({sel.length}{prompt.min === prompt.max ? `/${prompt.max}` : ` · ${prompt.min}–${prompt.max}`})
        </button>
      </div>
    </div>
  );
}

function SortBody({ prompt, disabled, onRespond }: { prompt: Extract<Prompt, { kind: "sort" }>; disabled: boolean; onRespond: R }) {
  const [order, setOrder] = useState<number[]>([]);
  const tap = (i: number) => setOrder((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
  return (
    <div className="stack">
      <p className="muted small">Karten in gewünschter Reihenfolge antippen (zuerst = oben bzw. erstes Glied).</p>
      <ul className="select-grid">
        {prompt.items.map((it, i) => (
          <li key={i}>
            <button className={`select-item ${order.includes(i) ? "on" : ""}`} onClick={() => tap(i)}>
              {it.card ? <CardThumb card={it.card} /> : null}<span className="small">{it.label}</span>
              {order.includes(i) && <span className="count-badge">{order.indexOf(i) + 1}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="row-actions">
        <button className="btn" disabled={disabled} onClick={() => onRespond(prompt.skip)}>Reihenfolge egal</button>
        <button className="btn primary" disabled={disabled || order.length !== prompt.items.length} onClick={() => onRespond(prompt.build(order))}>Bestätigen</button>
      </div>
    </div>
  );
}

function CounterBody({ prompt, disabled, onRespond }: { prompt: Extract<Prompt, { kind: "counter" }>; disabled: boolean; onRespond: R }) {
  const [counts, setCounts] = useState<number[]>(prompt.items.map(() => 0));
  const sum = counts.reduce((a, b) => a + b, 0);
  const change = (i: number, d: number) => setCounts((c) => c.map((n, j) => (j === i ? Math.max(0, Math.min(prompt.items[i].max, n + d)) : n)));
  return (
    <div className="stack">
      {prompt.items.map((it, i) => (
        <div key={i} className="count-row">
          <span>{it.label}</span>
          <button className="icon-btn" onClick={() => change(i, -1)} disabled={!counts[i]} aria-label="weniger">−</button>
          <span className="count">{counts[i]}</span>
          <button className="icon-btn" onClick={() => change(i, 1)} disabled={counts[i] >= it.max || sum >= prompt.total} aria-label="mehr">+</button>
        </div>
      ))}
      <button className="btn primary" disabled={disabled || sum !== prompt.total} onClick={() => onRespond(prompt.build(counts))}>Bestätigen ({sum}/{prompt.total})</button>
    </div>
  );
}

function AnnounceBody({ prompt, disabled, onRespond }: { prompt: Extract<Prompt, { kind: "announce-card" }>; disabled: boolean; onRespond: R }) {
  const data = useApp((s) => s.data)!;
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const k = nameKey(q);
    if (k.length < 2) return [];
    return prompt.candidates.filter((c) => {
      const r = data.cards.get(c)!;
      return nameKey(r.name).includes(k) || (r.nameDe ? nameKey(r.nameDe).includes(k) : false);
    }).slice(0, 40);
  }, [q, prompt.candidates, data]);
  return (
    <div className="stack">
      <input className="mini-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Kartenname (${prompt.candidates.length} möglich)`} aria-label="Kartenname ansagen" autoFocus />
      {hits.map((c) => <button key={c} className="btn action" disabled={disabled} onClick={() => onRespond(prompt.build(c))}>{cardName(data, c)}</button>)}
    </div>
  );
}
