// Duell-Bildschirm. Hochformat: Gegner oben, du in der Mitte, Hand unten, Auswahl als Bottom Sheet.
// Querformat: Feld mittig, Hand unten, Seitenleiste (Kette, Verlauf, Phasen) rechts oder links.
// Gleiche Komponenten in beiden Layouts (nur CSS) → Drehen verliert keinen Zustand.
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../app/store";
import { useDuel } from "../app/duel";
import { phaseName } from "../engine/text";
import { useLayout } from "../ui/hooks";
import { ConfirmDialog, Sheet } from "../ui/Sheet";
import { CardDetail } from "../screens/CardDetail";
import { fieldActions } from "./actions";
import { Field } from "./Field";
import { CardMenu, ChainView, HandBar, PileViewer, ProtocolView } from "./Parts";
import { useSettings } from "../app/settings";
import { SettingsFields } from "../ui/SettingsFields";
import { PromptPanel } from "./PromptPanel";

export function DuelScreen() {
  const layout = useLayout();
  const { data, set, detail } = useApp();
  const { sidebar, duelBg } = useSettings();
  const duel = useDuel();
  const { view, status, error, busy } = duel;
  const [dialog, setDialog] = useState<"leave" | "menu" | "log" | null>(null);

  // Nach Neuladen: Duell aus sessionStorage neu abspielen, sonst zurück zur Deckliste.
  useEffect(() => {
    if (useDuel.getState().status === "idle" && !useDuel.getState().restore()) set({ route: { screen: "decks" } });
  }, [set]);

  const actions = useMemo(() => fieldActions(view?.decision ?? null, data!), [view, data]);
  // Zonenwahl: Feld freihalten (Fenster eingeklappt), damit die leuchtenden Zonen antippbar sind.
  const zoneCount = actions.zones.size;
  useEffect(() => { if (zoneCount) useDuel.getState().setUi({ minimized: true }); }, [zoneCount, view]);
  // Android-Zurück-Taste im Duell: erst nachfragen, nicht einfach verlassen.
  useEffect(() => {
    const onBack = () => setDialog("leave");
    window.addEventListener("duel-back", onBack);
    return () => window.removeEventListener("duel-back", onBack);
  }, []);
  if (!data) return null;
  if (status === "error") return (
    <div className="page"><h1>Fehler im Duell</h1><p className="error" role="alert">{error}</p>
      <div className="row-actions"><button className="btn" onClick={() => duel.undo()}>Letzten Schritt zurück</button><button className="btn" onClick={() => { duel.leave(); set({ route: { screen: "decks" } }); }}>Zur Deckliste</button></div></div>
  );
  if (!view) return <div className="page loading"><p>Duell wird vorbereitet …</p></div>;

  const me = view.me, opp = (1 - me) as 0 | 1;
  const d = view.decision;
  const myTurn = view.turnPlayer === me;
  const leave = () => { duel.leave(); set({ route: { screen: "decks" }, detail: null }); };

  const info = (
    <div className="duel-info">
      <span className="lp opp" aria-label="Lebenspunkte Gegner">Gegner {view.players[opp].lp}</span>
      <span className="phase">Zug {view.turn} · {myTurn ? "du" : "Gegner"} · {phaseName(view.phase)}</span>
      <span className="lp me" aria-label="Deine Lebenspunkte">Du {view.players[me].lp}</span>
    </div>
  );
  const controls = (
    <div className="duel-controls">
      <button className="btn small" onClick={() => duel.undoAction()} disabled={busy || !view.steps} aria-label="Aktion rückgängig">↶ Aktion</button>
      <button className="btn small" onClick={() => duel.undo()} disabled={busy || !view.steps} aria-label="Einzelschritt rückgängig">↶ Schritt</button>
      {actions.general.map((o, i) => (
        <button key={i} className="btn small primary" disabled={busy} onClick={() => duel.respond(o.response)}>{o.label.replace("→ ", "")}</button>
      ))}
      <button className="btn small log-btn" onClick={() => setDialog("log")}>Protokoll</button>
      <button className="icon-btn" onClick={() => setDialog("menu")} aria-label="Duell-Menü">⋯</button>
    </div>
  );

  return (
    <div className={`duel ${layout} side-${sidebar} ${busy ? "busy" : ""}`} data-bg={duelBg}>
      <div className="duel-main">
        {info}
        <ChainView view={view} />
        <Field view={view} actions={actions} />
        {controls}
        <HandBar view={view} actions={actions} />
      </div>
      <aside className="duel-side" aria-label="Seitenleiste">
        {info}
        {controls}
        <ChainView view={view} />
        <ProtocolView />
      </aside>

      {view.result && (
        <div className="result-banner" role="status">
          Duell beendet – {view.result.winner === me ? "du gewinnst" : view.result.winner === 2 ? "unentschieden" : "der Gegner gewinnt"}
          <button className="btn small" onClick={() => duel.restart()}>Neu starten</button>
        </div>
      )}
      {d && !actions.onField && <PromptPanel decision={d} />}
      {actions.zones.size > 0 && duel.minimized && <p className="zone-hint" role="status">Leuchtende Zone antippen</p>}
      <CardMenu actions={actions} />
      <PileViewer view={view} actions={actions} />
      {detail !== null && <CardDetail />}

      {dialog === "log" && <Sheet title="Combo-Protokoll" onClose={() => setDialog(null)}><ProtocolView /></Sheet>}
      {dialog === "menu" && (
        <Sheet title="Duell" onClose={() => setDialog(null)}>
          <div className="stack">
            <p className="muted small">Seed {duel.config?.seed} · {view.steps} Entscheidungen · letzte Berechnung {duel.lastMs} ms</p>
            <button className="btn" onClick={() => { setDialog(null); duel.restart(); }}>Neu starten (gleicher Seed, gleiche Hand)</button>
            <button className="btn" onClick={() => { setDialog(null); duel.restart(Math.floor(Math.random() * 2 ** 32)); }}>Neu starten (neu mischen)</button>
            <SettingsFields />
            <button className="btn danger" onClick={() => setDialog("leave")}>Duell beenden</button>
          </div>
        </Sheet>
      )}
      {dialog === "leave" && <ConfirmDialog title="Duell beenden?" text="Der aktuelle Duellverlauf geht verloren." confirm="Beenden" danger onConfirm={leave} onClose={() => setDialog(null)} />}
    </div>
  );
}
