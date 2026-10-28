// Kartenbild von YGOPRODeck. Der Service Worker speichert jedes Bild beim ersten Laden dauerhaft
// (Cache First), danach kommt es nur noch vom Gerät – kein wiederholtes Laden vom Server.
import { useState } from "react";
import type { CardRecord } from "../data/types";
import { frame } from "../cards/info";
import { cardName } from "../engine/data";
import { useApp } from "../app/store";

const BASE = "https://images.ygoprodeck.com/images";

export function cardImageUrl(id: number, size: "small" | "large") {
  return `${BASE}/${size === "small" ? "cards_small" : "cards"}/${id}.jpg`;
}

export function CardImage({ card, size = "small", className = "" }: { card: CardRecord; size?: "small" | "large"; className?: string }) {
  const data = useApp((s) => s.data);
  const [failed, setFailed] = useState(false);
  const name = data ? cardName(data, card.id) : card.name;
  if (failed)
    return (
      <div className={`card-img placeholder frame-${frame(card)} ${className}`} role="img" aria-label={name}>
        <span>{name}</span>
      </div>
    );
  return (
    <img
      className={`card-img frame-${frame(card)} ${className}`}
      src={cardImageUrl(card.id, size)}
      alt={name}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
