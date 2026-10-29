// Duell-Start: Karten für die Gegnerhand (typisch Handtraps) und ob du für den Gegner antwortest.
import { useMemo, useState } from "react";
import { useApp } from "../app/store";
import { cardName } from "../engine/data";

/** Gängige Handtraps als Schnellauswahl (Passcodes; Anzeige deutsch aus den Kartendaten). */
export const HANDTRAPS = [
  14558127, // Ash Blossom & Joyous Spring
  97268402, // Effect Veiler
  10045474, // Infinite Impermanence
  27204311, // Nibiru, the Primal Being
  23434538, // Maxx "C"
  42141493, // Mulcharmy Fuwalos
  59438930, // Ghost Ogre & Snow Rabbit
  73642296, // Ghost Belle & Haunted Mansion
  52038441, // Ghost Mourner & Moonlit Chill
  94145021, // Droll & Lock Bird
  24508238, // D.D. Crow
  91800273, // Dimension Shifter
];
export const MAX_OPP_HAND = 10;

export function OpponentHand({ hand, setHand, mode, setMode }: {
  hand: number[]; setHand(h: number[]): void; mode: "ask" | "pass"; setMode(m: "ask" | "pass"): void;
}) {
  const { data, search } = useApp();
  const [query, setQuery] = useState("");
  const hits = useMemo(() => (search && query.trim().length >= 2 ? search.search(query, 6) : []), [search, query]);
  if (!data) return null;
  const full = hand.length >= MAX_OPP_HAND;
  const add = (code: number) => {
    if (full) return;
    // Erste Handtrap: Antworten des Gegners einschalten – sonst würde sie nie benutzt.
    if (!hand.length) setMode("ask");
    setHand([...hand, code]);
  };
  const quick = HANDTRAPS.filter((c) => data.cards.has(c));

  return (
    <div className="field opp-hand-pick">
      <span>Gegnerhand zu Beginn ({hand.length}{hand.length < 5 ? `, Rest ${5 - hand.length} zufällig aus seinem Deck` : ""})</span>
      {hand.length > 0 && (
        <div className="chips" aria-label="Gewählte Karten der Gegnerhand">
          {hand.map((c, i) => (
            <button key={i} className="chip on" aria-label={`${cardName(data, c)} aus der Gegnerhand entfernen`} onClick={() => setHand(hand.filter((_, j) => j !== i))}>{cardName(data, c)} ✕</button>
          ))}
        </div>
      )}
      <div className="chips" aria-label="Handtraps hinzufügen">
        {quick.map((c) => (
          <button key={c} className="chip" disabled={full} aria-label={`${cardName(data, c)} zur Gegnerhand`} onClick={() => add(c)}>+ {cardName(data, c)}</button>
        ))}
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Andere Karte suchen …" aria-label="Karte für die Gegnerhand suchen" />
      {hits.length > 0 && (
        <div className="chips" aria-label="Suchtreffer">
          {hits.map((h) => (
            <button key={h.card.id} className="chip" disabled={full} aria-label={`${cardName(data, h.card.id)} zur Gegnerhand`} onClick={() => { add(h.card.id); setQuery(""); }}>+ {cardName(data, h.card.id)}</button>
          ))}
        </div>
      )}
      <div className="segmented" role="radiogroup" aria-label="Gegner-Antworten">
        <button role="radio" aria-checked={mode === "ask"} className={mode === "ask" ? "on" : ""} onClick={() => setMode("ask")}>Ich antworte für den Gegner</button>
        <button role="radio" aria-checked={mode === "pass"} className={mode === "pass" ? "on" : ""} onClick={() => setMode("pass")}>Gegner antwortet nie</button>
      </div>
      <p className="muted small">
        „Ich antworte für den Gegner“: Kann der Gegner auf deine Züge reagieren (z. B. Ash Blossom auf deine Suche), fragt dich die
        App rot markiert, ob er es tut – samt Zielen. So übst du, durch Handtraps durchzuspielen. Seine Hand siehst du
        über „Gegner: n“ neben deiner Hand.
      </p>
    </div>
  );
}
