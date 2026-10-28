// Deckformat .ydk (YGOPro/EDOPro): Abschnitte #main, #extra, !side, je eine Passcode-Zeile pro Karte.
import type { DeckList } from "../engine/session";

export function parseYdk(text: string): Required<DeckList> {
  const deck: Required<DeckList> = { main: [], extra: [], side: [] };
  let section: keyof DeckList | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "#main") section = "main";
    else if (line === "#extra") section = "extra";
    else if (line === "!side") section = "side";
    else if (section && /^\d+$/.test(line)) deck[section].push(Number(line));
  }
  return deck;
}

export function toYdk(deck: DeckList, creator = "YuGiOh-Combos-Trainer"): string {
  return [`#created by ${creator}`, "#main", ...deck.main, "#extra", ...deck.extra, "!side", ...(deck.side ?? []), ""].join("\n");
}
