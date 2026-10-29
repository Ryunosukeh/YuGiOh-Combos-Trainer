// „Duell starten“: Zugreihenfolge, Starthand (zufällig oder Testhand), optionaler Seed.
import { useMemo, useState } from "react";
import { useApp, useDeck } from "../app/store";
import { useDuel } from "../app/duel";
import { T } from "../cards/info";
import { cardName } from "../engine/data";
import { randomSeed } from "../engine/seed";
import { CardImage } from "../ui/CardImage";
import { Sheet } from "../ui/Sheet";
import { SAMPLE_DECKS } from "../fixtures/sampleDecks";
import { useSettings, type OpponentPrefs } from "../app/settings";
import { OpponentHand } from "./OpponentHand";

export function DuelSetup() {
  const { duelSetup, set, data } = useApp();
  const deck = useDeck(duelSetup ?? "");
  const start = useDuel((s) => s.start);
  const [goFirst, setGoFirst] = useState(true);
  const [mode, setMode] = useState<"random" | "test">("random");
  const [hand, setHand] = useState<number[]>([]);
  const [fill, setFill] = useState(false);
  const [seedText, setSeedText] = useState("");
  const [chainPrompts, setChainPrompts] = useState<"auto" | "all">("auto");
  // Gegner-Einstellungen bleiben gerätebezogen gespeichert (Einstellungen), Deck: "sample:<id>" oder "deck:<id>".
  const opp = useSettings((s) => s.opp);
  const setOpp = (p: Partial<OpponentPrefs>) => useSettings.getState().setSettings({ opp: { ...useSettings.getState().opp, ...p } });
  const { deck: oppDeck, behavior } = opp;
  const decks = useApp((s) => s.decks);

  const unique = useMemo(() => {
    if (!deck || !data) return [];
    const m = new Map<number, number>();
    for (const c of deck.main) m.set(c, (m.get(c) ?? 0) + 1);
    const order = (code: number) => { const t = data.cards.get(code)!.type; return t & T.MONSTER ? 0 : t & T.SPELL ? 1 : 2; };
    return [...m].sort((a, b) => order(a[0]) - order(b[0]) || cardName(data, a[0]).localeCompare(cardName(data, b[0])));
  }, [deck, data]);

  if (!duelSetup || !deck || !data) return null;
  const close = () => set({ duelSetup: null });
  const inHand = (c: number) => hand.filter((x) => x === c).length;
  const seedOk = seedText.trim() === "" || /^\d{1,10}$/.test(seedText.trim());

  const opponentDeck = () => {
    const [kind, oid] = oppDeck.split(":");
    if (kind === "deck") { const d = decks.find((x) => x.id === oid); if (d?.main.length) return { main: d.main, extra: d.extra }; }
    // Gespeichertes eigenes Deck gelöscht → Beispieldeck
    return { main: (SAMPLE_DECKS.find((x) => x.id === oid) ?? SAMPLE_DECKS[0]).main, extra: [] };
  };

  const go = () => {
    const seed = seedText.trim() ? Number(seedText.trim()) : randomSeed();
    start({
      deck: { main: deck.main, extra: deck.extra, side: deck.side },
      seed, goFirst, chainPrompts,
      opponent: { deck: opponentDeck(), behavior, hand: opp.hand.filter((c) => data.cards.has(c)), mode: opp.mode },
      ...(mode === "test" && hand.length ? { hand, fillHand: fill } : {}),
    }, deck.id);
    set({ duelSetup: null, route: { screen: "duel" }, detail: null });
  };

  return (
    <Sheet title={`Duell: ${deck.name}`} onClose={close} wide
      footer={<><button className="btn" onClick={close}>Abbrechen</button><button className="btn primary" onClick={go} disabled={!deck.main.length || !seedOk}>Duell starten</button></>}>
      <div className="stack">
        {deck.main.length < 40 && <p className="muted small">Hinweis: Main Deck hat nur {deck.main.length} Karten – zum Üben trotzdem möglich.</p>}
        <div className="segmented" role="radiogroup" aria-label="Zugreihenfolge">
          <button role="radio" aria-checked={goFirst} className={goFirst ? "on" : ""} onClick={() => setGoFirst(true)}>Erster Zug</button>
          <button role="radio" aria-checked={!goFirst} className={!goFirst ? "on" : ""} onClick={() => setGoFirst(false)}>Zweiter Zug</button>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Starthand">
          <button role="radio" aria-checked={mode === "random"} className={mode === "random" ? "on" : ""} onClick={() => setMode("random")}>Zufällige Hand</button>
          <button role="radio" aria-checked={mode === "test"} className={mode === "test" ? "on" : ""} onClick={() => setMode("test")}>Testhand</button>
        </div>
        {mode === "test" && (
          <>
            <p className="small">Karten antippen, die du auf der Hand haben willst ({hand.length} gewählt). Erneut tippen = eine weniger.</p>
            <div className="chips">
              {hand.map((c, i) => <button key={i} className="chip on" onClick={() => setHand((h) => h.filter((_, j) => j !== i))}>{cardName(data, c)} ✕</button>)}
            </div>
            <label className="check"><input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Rest zufällig auf 5 Karten auffüllen</label>
            <ul className="hand-pick">
              {unique.map(([code, n]) => {
                const k = inHand(code);
                return (
                  <li key={code}>
                    <button className={`select-item ${k ? "on" : ""}`} aria-label={`${cardName(data, code)} (${k}/${n})`}
                      onClick={() => setHand((h) => (k < n ? [...h, code] : h.filter((x) => x !== code)))}>
                      <span className="thumb" aria-hidden="true"><CardImage card={data.cards.get(code)!} /></span>
                      <span className="small">{cardName(data, code)}</span>
                      {k > 0 && <span className="count-badge">{k}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <label className="field">
          <span>Gegnerdeck</span>
          <select value={oppDeck} onChange={(e) => setOpp({ deck: e.target.value })} aria-label="Gegnerdeck">
            <optgroup label="Beispieldecks (schwach)">
              {SAMPLE_DECKS.map((d) => <option key={d.id} value={`sample:${d.id}`}>{d.name}</option>)}
            </optgroup>
            {decks.some((d) => d.main.length) && (
              <optgroup label="Eigene Decks">
                {decks.filter((d) => d.main.length).map((d) => <option key={d.id} value={`deck:${d.id}`}>{d.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <div className="segmented" role="radiogroup" aria-label="Gegnerverhalten">
          <button role="radio" aria-checked={behavior === "set"} className={behavior === "set" ? "on" : ""} onClick={() => setOpp({ behavior: "set" })}>Gegner setzt Karten</button>
          <button role="radio" aria-checked={behavior === "passive"} className={behavior === "passive" ? "on" : ""} onClick={() => setOpp({ behavior: "passive" })}>Gegner passiv</button>
        </div>
        <p className="muted small">Von sich aus aktiviert der Gegner nie etwas und greift nie an. „Setzt Karten“: pro Zug ein Monster verdeckt und Zauber/Fallen gesetzt – so hat das Feld Ziele und seine Hand läuft nicht über.</p>
        <OpponentHand hand={opp.hand} setHand={(hand) => setOpp({ hand })} mode={opp.mode} setMode={(mode) => setOpp({ mode })} />
        <div className="segmented" role="radiogroup" aria-label="Antwortfenster">
          <button role="radio" aria-checked={chainPrompts === "auto"} className={chainPrompts === "auto" ? "on" : ""} onClick={() => setChainPrompts("auto")}>Ketten: nur wenn sinnvoll</button>
          <button role="radio" aria-checked={chainPrompts === "all"} className={chainPrompts === "all" ? "on" : ""} onClick={() => setChainPrompts("all")}>Ketten: immer fragen</button>
        </div>
        <p className="muted small">„Nur wenn sinnvoll“ fragt wie EDOPro nur, wenn eine Karte gerade passend antworten kann – aber nie auf deine eigenen Effekte (keine Ash auf die eigene Suche). Schnellzauber aktivierst du jederzeit in deiner Main Phase.</p>
        <label className="field">
          <span>Seed (leer = zufällig; gleicher Seed = gleiches Mischen)</span>
          <input inputMode="numeric" value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="z. B. 1234" aria-invalid={!seedOk} />
        </label>
      </div>
    </Sheet>
  );
}
