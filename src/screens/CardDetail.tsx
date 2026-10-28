// Große Kartenansicht mit Text (DE/EN umschaltbar) und – im Deckbuilder – Knöpfen zum Hinzufügen/Entfernen.
import { useApp, useDeck } from "../app/store";
import { baseId, isDeckable, statLine, typeLine } from "../cards/info";
import { allowedCount, defaultLfList, sectionFor } from "../deck/validate";
import { SECTION_NAMES, type Section } from "../deck/types";
import { CardImage } from "../ui/CardImage";
import { Sheet } from "../ui/Sheet";

export function CardDetail({ deckId }: { deckId?: string }) {
  const { data, detail, lang, set, updateDeck } = useApp();
  const deck = useDeck(deckId ?? "");
  if (!data || detail === null) return null;
  const card = data.cards.get(detail);
  if (!card) return null;

  const de = lang === "de";
  const name = (de && card.nameDe) || card.name;
  const other = de ? (card.nameDe ? card.name : null) : card.nameDe;
  const text = (de && card.descDe) || card.desc;
  const lf = defaultLfList(data);
  const allowed = allowedCount(data, lf, card.id);
  const stat = statLine(card);

  const sameCard = (code: number) => { const c = data.cards.get(code); return c ? baseId(c) === baseId(card) : false; };
  const inDeck = (s: Section) => (deck ? deck[s].filter(sameCard).length : 0);
  const total = deck ? inDeck("main") + inDeck("extra") + inDeck("side") : 0;
  const home: Section = sectionFor(data, card.id);

  const add = (s: Section) => deck && updateDeck(deck.id, (d) => { d[sectionFor(data, card.id, s)].push(card.id); });
  const remove = (s: Section) => deck && updateDeck(deck.id, (d) => {
    const i = d[s].findLastIndex(sameCard);
    if (i >= 0) d[s].splice(i, 1);
  });

  return (
    <Sheet title={name} onClose={() => set({ detail: null })} wide>
      <div className="card-detail">
        <div className="detail-side">
          <CardImage card={card} size="large" className="detail-img" />
          {deck && isDeckable(card) && (
            <div className="detail-actions">
              {(home === "extra" ? (["extra", "side"] as Section[]) : (["main", "side"] as Section[])).map((s) => (
                <div className="count-row" key={s}>
                  <span>{SECTION_NAMES[s]}</span>
                  <button className="icon-btn" onClick={() => remove(s)} disabled={!inDeck(s)} aria-label={`Aus ${SECTION_NAMES[s]} entfernen`}>−</button>
                  <span className="count" aria-live="polite">{inDeck(s)}</span>
                  <button className="icon-btn" onClick={() => add(s)} disabled={total >= 3} aria-label={`Zu ${SECTION_NAMES[s]} hinzufügen`}>+</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <div className="lang-toggle" role="group" aria-label="Sprache">
            <button className={de ? "on" : ""} onClick={() => set({ lang: "de" })} aria-pressed={de}>DE</button>
            <button className={!de ? "on" : ""} onClick={() => set({ lang: "en" })} aria-pressed={!de}>EN</button>
          </div>
          {other && <p className="muted small">{other}</p>}
          <p className="type-line">{typeLine(card)}</p>
          {stat && <p className="stat-line">{stat}</p>}
          {lf && allowed < 3 && <p className={`ban ban-${allowed}`}>{allowed === 0 ? "Verboten" : allowed === 1 ? "Limitiert" : "Semi-limitiert"} ({lf.name})</p>}
          {de && !card.descDe && <p className="muted small">Kein deutscher Text verfügbar – englischer Text:</p>}
          <p className="card-text">{text}</p>
          <p className="muted small">Passcode {card.id}</p>
        </div>
      </div>
    </Sheet>
  );
}
