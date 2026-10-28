// Startseite: gespeicherte Decks – öffnen, neu, importieren, umbenennen, kopieren, löschen.
import { useState } from "react";
import { useApp } from "../app/store";
import { defaultLfList, validateDeck } from "../deck/validate";
import type { Deck } from "../deck/types";
import { ConfirmDialog, InputDialog, Sheet } from "../ui/Sheet";
import { ImportDialog } from "./ImportDialog";

type Dialog = { kind: "new" } | { kind: "rename" | "menu" | "delete"; deck: Deck } | null;

export function DeckList() {
  const { decks, set, createDeck, updateDeck, copyDeck, deleteDeck, data } = useApp();
  const [dialog, setDialog] = useState<Dialog>(null);
  const lf = data ? defaultLfList(data) : undefined;
  const open = (d: Deck) => set({ route: { screen: "deck", id: d.id }, detail: null, tab: d.main.length ? "deck" : "search" });

  return (
    <div className="page">
      <header className="topbar plain">
        <h1>Meine Decks</h1>
      </header>
      <div className="row-actions">
        <button className="btn primary" onClick={() => setDialog({ kind: "new" })}>Neues Deck</button>
        <button className="btn" onClick={() => set({ import: { target: { kind: "new" }, text: "", preview: null, deckName: "" } })}>Liste importieren</button>
      </div>
      {decks.length === 0 ? (
        <p className="hint">Noch keine Decks. Lege ein neues an oder füge eine ganze Liste über „Liste importieren“ ein.</p>
      ) : (
        <ul className="deck-list">
          {decks.map((d) => {
            const ok = data ? validateDeck(d, data, lf).length === 0 : true;
            return (
              <li key={d.id} className="deck-item">
                <button className="deck-open" onClick={() => open(d)}>
                  <span className="deck-name">{d.name}</span>
                  <span className="muted small">Main {d.main.length} · Extra {d.extra.length} · Side {d.side.length} · {ok ? "gültig" : "nicht gültig"}</span>
                </button>
                <button className="icon-btn" onClick={() => setDialog({ kind: "menu", deck: d })} aria-label={`Aktionen für ${d.name}`}>⋯</button>
              </li>
            );
          })}
        </ul>
      )}
      <footer className="page-foot">
        <button className="link" onClick={() => set({ route: { screen: "system" } })}>Systemcheck</button>
        {data && <span className="muted small">Daten {data.manifest.version}</span>}
        <span className="muted small">Kartentexte: YGOPRODeck, Yugipedia (CC BY-SA 4.0) · Regeln: Project Ignis</span>
      </footer>

      <ImportDialog />
      {dialog?.kind === "new" && (
        <InputDialog title="Neues Deck" label="Name" initial="Neues Deck" confirm="Anlegen" onClose={() => setDialog(null)}
          onConfirm={async (name) => open(await createDeck(name))} />
      )}
      {dialog?.kind === "rename" && (
        <InputDialog title="Deck umbenennen" label="Name" initial={dialog.deck.name} confirm="Speichern" onClose={() => setDialog(null)}
          onConfirm={(name) => updateDeck(dialog.deck.id, (x) => { x.name = name; })} />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog title="Deck löschen?" text={`„${dialog.deck.name}“ wird endgültig gelöscht.`} confirm="Löschen" danger onClose={() => setDialog(null)}
          onConfirm={() => deleteDeck(dialog.deck.id)} />
      )}
      {dialog?.kind === "menu" && (
        <Sheet title={dialog.deck.name} onClose={() => setDialog(null)}>
          <div className="stack">
            <button className="btn" onClick={() => { open(dialog.deck); }}>Öffnen</button>
            <button className="btn" onClick={() => setDialog({ kind: "rename", deck: dialog.deck })}>Umbenennen</button>
            <button className="btn" onClick={async () => { await copyDeck(dialog.deck.id); setDialog(null); }}>Kopieren</button>
            <button className="btn danger" onClick={() => setDialog({ kind: "delete", deck: dialog.deck })}>Löschen</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
