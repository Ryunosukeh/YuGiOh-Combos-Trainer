// Lädt das Daten-Bundle im Browser (von GitHub Pages bzw. im Dev-Server von data/bundle).
import { PackScriptSource, type GameData } from "../engine/data";
import { BUNDLE_FILES, BUNDLE_FORMAT, type CardsFile, type Manifest } from "../data/types";

export type Progress = (step: string) => void;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Entpackt gzip; falls der Server schon entpackt geliefert hat (Content-Encoding), unverändert zurück. */
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function loadBundleFromUrl(base: string, progress: Progress = () => {}): Promise<GameData> {
  const url = (f: string) => new URL(f, base).toString();
  const json = async <T>(f: string) => JSON.parse(new TextDecoder().decode(await fetchBytes(url(f)))) as T;

  progress("Manifest");
  const manifest = await json<Manifest>(BUNDLE_FILES.manifest);
  if (manifest.format !== BUNDLE_FORMAT) throw new Error(`Datenpaket-Format ${manifest.format}, erwartet ${BUNDLE_FORMAT}`);

  progress("Karten");
  const cardsFile = JSON.parse(new TextDecoder().decode(await gunzip(await fetchBytes(url(BUNDLE_FILES.cards))))) as CardsFile;
  progress("Skripte");
  const [pack, index] = await Promise.all([gunzip(await fetchBytes(url(BUNDLE_FILES.scriptPack))), json<Record<string, [number, number]>>(BUNDLE_FILES.scriptIndex)]);
  progress("Banlisten und Texte");
  const [lflists, strings] = await Promise.all([json<GameData["lflists"]>(BUNDLE_FILES.lflists), json<GameData["strings"]>(BUNDLE_FILES.strings)]);

  return {
    manifest,
    cards: new Map(cardsFile.cards.map((c) => [c.id, c])),
    scripts: new PackScriptSource(pack, index),
    lflists,
    strings,
  };
}
