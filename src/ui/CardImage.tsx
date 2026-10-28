// Kartenbild von YGOPRODeck. Der Service Worker speichert jedes Bild beim ersten Laden dauerhaft
// (Cache First), danach kommt es nur noch vom Gerät – kein wiederholtes Laden vom Server.
import { useEffect, useState } from "react";
import { isNative, nativeImage } from "../platform";
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
  const url = cardImageUrl(card.id, size);
  // App: Bild nativ laden und lokal speichern; bis dahin Platzhalter.
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    setLocal(null);
    nativeImage(url).then((u) => { if (!alive) return; if (u) setLocal(u); else setFailed(true); });
    return () => { alive = false; };
  }, [url]);
  const name = data ? cardName(data, card.id) : card.name;
  if (failed || (isNative && !local))
    return (
      <div className={`card-img placeholder frame-${frame(card)} ${className}`} role="img" aria-label={name}>
        <span>{name}</span>
      </div>
    );
  return (
    <img
      className={`card-img frame-${frame(card)} ${className}`}
      src={isNative ? local! : url}
      alt={name}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
