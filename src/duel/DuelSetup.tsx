// „Duell starten“: Zugreihenfolge, Starthand (zufällig oder Testhand), optionaler Seed.
import { useMemo, useState } from "react";
import { useApp, useDeck } from "../app/store";
import { useDuel } from "../app/duel";
import { T } from "../cards/info";
import { cardName } from "../engine/data";
import { randomSeed } from "../engine/seed";
import { CardImage } from "../ui/CardImage";
import { Sheet } from "../ui/Sheet";

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

  const go = () => {
    const seed = seedText.trim() ? Number(seedText.trim()) : randomSeed();
    start({
      deck: { main: deck.main, extra: deck.extra, side: deck.side },
      seed, goFirst, chainPrompts,
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
        <div className="segmented" role="radiogroup" aria-label="Antwortfenster">
          <button role="radio" aria-checked={chainPrompts === "auto"} className={chainPrompts === "auto" ? "on" : ""} onClick={() => setChainPrompts("auto")}>Ketten: nur wenn sinnvoll</button>
          <button role="radio" aria-checked={chainPrompts === "all"} className={chainPrompts === "all" ? "on" : ""} onClick={() => setChainPrompts("all")}>Ketten: immer fragen</button>
        </div>
        <p className="muted small">„Nur wenn sinnvoll“ fragt wie EDOPro nur, wenn eine Karte gerade passend antworten kann (z. B. Ash Blossom auf eine Suche). Schnellzauber kannst du jederzeit in deiner Main Phase aktivieren.</p>
        <label className="field">
          <span>Seed (leer = zufällig; gleicher Seed = gleiches Mischen)</span>
          <input inputMode="numeric" value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="z. B. 1234" aria-invalid={!seedOk} />
        </label>
      </div>
    </Sheet>
  );
}
