// ydke://-Links (YGOPRODeck/EDOPro): base64(Uint32 LE Passcodes) für Main!Extra!Side!
import type { DeckList } from "../engine/session";

function encode(codes: number[]): string {
  const bytes = new Uint8Array(codes.length * 4);
  const view = new DataView(bytes.buffer);
  codes.forEach((c, i) => view.setUint32(i * 4, c, true));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decode(part: string): number[] {
  if (!part) return [];
  const bin = atob(part);
  if (bin.length % 4) throw new Error("ydke: ungültige Länge");
  const view = new DataView(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)).buffer);
  const out: number[] = [];
  for (let i = 0; i < bin.length; i += 4) out.push(view.getUint32(i, true));
  return out;
}

export function isYdke(text: string): boolean {
  return /^\s*ydke:\/\//i.test(text);
}

export function parseYdke(text: string): Required<DeckList> {
  const m = /ydke:\/\/([A-Za-z0-9+/=]*)!([A-Za-z0-9+/=]*)!([A-Za-z0-9+/=]*)!?/i.exec(text.trim());
  if (!m) throw new Error("Kein gültiger ydke://-Link");
  return { main: decode(m[1]), extra: decode(m[2]), side: decode(m[3]) };
}

export function toYdke(deck: DeckList): string {
  return `ydke://${encode(deck.main)}!${encode(deck.extra)}!${encode(deck.side ?? [])}!`;
}
