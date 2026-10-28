// Eine Karte im Duell: offen (Bild), verdeckt (Rückseite), Verteidigung quer.
import { useApp } from "../app/store";
import type { CardView } from "../engine/view";
import { CardImage } from "../ui/CardImage";

export function DuelCard({ card, hidden = false, noStats = false }: { card: CardView; hidden?: boolean; noStats?: boolean }) {
  const data = useApp((s) => s.data);
  const rec = card.code ? data?.cards.get(card.code) : undefined;
  const faceUp = (card.position & 0x5) !== 0;
  const defense = (card.position & 0xc) !== 0 && (card.position & 0x3) === 0;
  const showBack = hidden || !rec;
  return (
    <span className={`duel-card ${defense ? "def" : ""} ${faceUp ? "" : "facedown"}`}>
      {showBack ? <span className="card-back" /> : <CardImage card={rec!} />}
      {!showBack && !faceUp && <span className="fd-mark" aria-hidden>verdeckt</span>}
      {!noStats && faceUp && card.atk !== undefined && rec && rec.type & 1 && (
        <span className="stats">{card.atk}{card.link ? "" : `/${card.def}`}</span>
      )}
    </span>
  );
}
