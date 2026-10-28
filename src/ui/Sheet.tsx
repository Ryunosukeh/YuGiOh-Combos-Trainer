// Dialog-Container: im Hochformat Bottom Sheet, im Querformat Seitenpanel (Feld/Liste bleibt sichtbar).
// Gleiche Komponente in beiden Layouts – beim Drehen wird nichts neu aufgebaut, Eingaben bleiben erhalten.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLayout } from "./hooks";

export function Sheet(props: { title: string; onClose(): void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const layout = useLayout();
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return (
    <div className={`sheet-backdrop ${layout}`} onClick={props.onClose}>
      <section className={`sheet ${layout} ${props.wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id={titleId}>{props.title}</h2>
          <button className="icon-btn" onClick={props.onClose} aria-label="Schließen">✕</button>
        </header>
        <div className="sheet-body">{props.children}</div>
        {props.footer && <footer className="sheet-foot">{props.footer}</footer>}
      </section>
    </div>
  );
}

/** Einfacher Eingabe-Dialog (Umbenennen, neues Deck). */
export function InputDialog(props: { title: string; label: string; initial: string; confirm: string; onConfirm(v: string): void; onClose(): void }) {
  const [value, setValue] = useState(props.initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  const ok = () => { const v = value.trim(); if (v) { props.onConfirm(v); props.onClose(); } };
  return (
    <Sheet title={props.title} onClose={props.onClose} footer={<><button className="btn" onClick={props.onClose}>Abbrechen</button><button className="btn primary" onClick={ok} disabled={!value.trim()}>{props.confirm}</button></>}>
      <label className="field">
        <span>{props.label}</span>
        <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} autoFocus />
      </label>
    </Sheet>
  );
}

/** Rückfrage vor Löschen o. Ä. */
export function ConfirmDialog(props: { title: string; text: string; confirm: string; danger?: boolean; onConfirm(): void; onClose(): void }) {
  return (
    <Sheet title={props.title} onClose={props.onClose} footer={<><button className="btn" onClick={props.onClose}>Abbrechen</button><button className={`btn ${props.danger ? "danger" : "primary"}`} onClick={() => { props.onConfirm(); props.onClose(); }}>{props.confirm}</button></>}>
      <p>{props.text}</p>
    </Sheet>
  );
}
