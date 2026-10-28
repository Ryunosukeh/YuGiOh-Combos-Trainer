// Massen-Import mit Vorschau: sicher erkannt / unsicher (Vorschläge antippen) / nicht gefunden.
// Text, Vorschau und Auswahl liegen im Store → bleiben beim Drehen erhalten.
import { useState } from "react";
import { useApp } from "../app/store";
import { buildDeck, previewImport, type ImportItem } from "../deck/import";
import { cardName } from "../engine/data";
import { Sheet } from "../ui/Sheet";

const EXAMPLE = "Main Deck\n3x Mementotlanische Enghexe\n2 Ash Blossom & Joyous Spring\nExtra Deck\n1x Mementomictlan Tecuhtlica - Schöpfungskönig";

export function ImportDialog() {
  const { import: imp, set, data, search, createDeck, updateDeck, decks } = useApp();
  if (!imp || !data || !search) return null;
  const update = (p: Partial<typeof imp>) => set({ import: { ...imp, ...p } });
  const close = () => set({ import: null });

  const check = () => update({ preview: previewImport(imp.text, data, search) });
  const choose = (line: number, id: number | null) =>
    imp.preview && update({ preview: { ...imp.preview, items: imp.preview.items.map((it) => (it.line === line ? { ...it, chosen: id } : it)) } });

  const items = imp.preview?.items ?? [];
  const built = imp.preview ? buildDeck(items, data) : null;
  const target = imp.target;

  const apply = async () => {
    if (!built) return;
    if (target.kind === "new") {
      const d = await createDeck(imp.deckName.trim() || "Importiertes Deck", built);
      set({ import: null, route: { screen: "deck", id: d.id }, tab: "deck", detail: null });
    } else {
      await updateDeck(target.id, (d) => {
        if (target.mode === "replace") { d.main = built.main; d.extra = built.extra; d.side = built.side; }
        else { d.main.push(...built.main); d.extra.push(...built.extra); d.side.push(...built.side); }
      });
      set({ import: null, tab: "deck" });
    }
  };

  const loadFile = async (f: File | undefined) => { if (f) update({ text: await f.text(), preview: null }); };
  const groups: [string, ImportItem[]][] = [
    ["Nicht gefunden", items.filter((i) => i.status === "fehlt")],
    ["Unsicher – bitte prüfen", items.filter((i) => i.status === "unsicher")],
    ["Sicher erkannt", items.filter((i) => i.status === "sicher")],
  ];
  const targetDeck = target.kind === "deck" ? decks.find((d) => d.id === target.id) : undefined;

  return (
    <Sheet title={target.kind === "new" ? "Deck importieren" : `Import in „${targetDeck?.name ?? ""}“`} onClose={close} wide
      footer={imp.preview ? (
        <>
          <button className="btn" onClick={() => update({ preview: null })}>Zurück zum Text</button>
          <button className="btn primary" onClick={apply} disabled={!built || built.main.length + built.extra.length + built.side.length === 0}>
            Übernehmen ({built?.main.length ?? 0}/{built?.extra.length ?? 0}/{built?.side.length ?? 0})
          </button>
        </>
      ) : (
        <>
          <button className="btn" onClick={close}>Abbrechen</button>
          <button className="btn primary" onClick={check} disabled={!imp.text.trim()}>Prüfen</button>
        </>
      )}>
      {!imp.preview ? (
        <div className="stack">
          <p className="muted small">Ganze Liste einfügen: „3x Name“, „3 Name“ oder „Name x3“, deutsch oder englisch. Überschriften „Main Deck“, „Extra Deck“, „Side Deck“ werden erkannt, Extra-Deck-Monster automatisch zugeordnet. Auch .ydk-Inhalt und ydke://-Links funktionieren.</p>
          <textarea className="import-text" value={imp.text} onChange={(e) => update({ text: e.target.value })} placeholder={EXAMPLE} rows={12} aria-label="Deckliste" spellCheck={false} />
          <label className="btn file-btn">.ydk-Datei öffnen<input type="file" accept=".ydk,.txt,text/plain" onChange={(e) => loadFile(e.target.files?.[0])} /></label>
        </div>
      ) : (
        <div className="stack">
          <p className="summary" role="status">
            <span className="chip ok">{groups[2][1].length} sicher</span>
            <span className="chip warn">{groups[1][1].length} unsicher</span>
            <span className="chip bad">{groups[0][1].length} nicht gefunden</span>
          </p>
          {groups.map(([title, list]) => list.length > 0 && (
            <section key={title} className="import-group">
              <h3>{title} <span className="muted">({list.length})</span></h3>
              <ul className="import-list">{list.map((it) => <ImportRow key={it.line} item={it} onChoose={(id) => choose(it.line, id)} />)}</ul>
            </section>
          ))}
          {target.kind === "new" ? (
            <label className="field"><span>Name des neuen Decks</span>
              <input value={imp.deckName} onChange={(e) => update({ deckName: e.target.value })} placeholder="Importiertes Deck" />
            </label>
          ) : (
            <div className="segmented" role="radiogroup" aria-label="Importmodus">
              {(["add", "replace"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={target.mode === m} className={target.mode === m ? "on" : ""}
                  onClick={() => update({ target: { ...target, mode: m } })}>{m === "add" ? "Hinzufügen" : "Deck ersetzen"}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ImportRow({ item, onChoose }: { item: ImportItem; onChoose(id: number | null): void }) {
  const { data, search } = useApp();
  const [q, setQ] = useState("");
  const extra = q.trim().length >= 2 && search ? search.search(q, 5).map((h) => ({ id: h.card.id, name: cardName(data!, h.card.id), score: h.score })) : [];
  const options = [...item.candidates, ...extra.filter((e) => !item.candidates.some((c) => c.id === e.id))];
  return (
    <li className={`import-row ${item.status}`}>
      <div className="import-line">
        <span className="count">{item.count}×</span>
        <span className="raw">{item.name}</span>
        <span className="muted small">Zeile {item.line}</span>
      </div>
      {item.status === "sicher" ? (
        <p className="small">→ {cardName(data!, item.chosen!)}</p>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label={`Vorschläge für ${item.name}`}>
            {options.map((c) => (
              <button key={c.id} role="radio" aria-checked={item.chosen === c.id} className={`chip ${item.chosen === c.id ? "on" : ""}`} onClick={() => onChoose(c.id)}>{c.name}</button>
            ))}
            <button role="radio" aria-checked={item.chosen === null} className={`chip ${item.chosen === null ? "on" : ""}`} onClick={() => onChoose(null)}>auslassen</button>
          </div>
          <input className="mini-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Andere Karte suchen…" aria-label={`Andere Karte für ${item.name} suchen`} />
        </>
      )}
    </li>
  );
}
