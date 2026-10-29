// Lädt das Daten-Bundle im Browser (von GitHub Pages bzw. im Dev-Server von data/bundle).
import { PackScriptSource, type GameData } from "../engine/data";
import { BUNDLE_FILES, BUNDLE_FORMAT, type CardsFile, type Manifest } from "../data/types";

export type Progress = (step: string) => void;

async function fetchBytes(url: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // Netzwerkfehler sagen nur „Failed to fetch“/„Load failed“ → verständlich machen, mit Adresse.
    throw new Error(`Keine Verbindung zu ${new URL(url).host} – beim ersten Start wird Internet gebraucht (${url})`);
  }
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const CACHE = "data-bundle";
const hasCache = () => typeof caches !== "undefined";

/** Datei des Bundles: aus dem Cache (gleiche Version) oder einmal laden und ablegen. */
async function cachedBytes(url: string, version: string): Promise<Uint8Array> {
  if (!hasCache()) return fetchBytes(url);
  const cache = await caches.open(CACHE);
  const key = `${url}?v=${encodeURIComponent(version)}`;
  const hit = await cache.match(key);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const bytes = await fetchBytes(url);
  await cache.put(key, new Response(bytes as BlobPart));
  return bytes;
}

/** Manifest: zuerst Netz (neue Version erkennen), offline die zuletzt gespeicherte. */
async function manifestBytes(url: string): Promise<Uint8Array> {
  try {
    const bytes = await fetchBytes(url);
    if (hasCache()) await (await caches.open(CACHE)).put(url, new Response(bytes as BlobPart));
    return bytes;
  } catch (e) {
    const hit = hasCache() ? await (await caches.open(CACHE)).match(url) : undefined;
    if (hit) return new Uint8Array(await hit.arrayBuffer());
    throw e;
  }
}

/** Einträge alter Versionen entfernen. */
async function pruneCache(version: string, manifestUrl: string) {
  if (!hasCache()) return;
  const cache = await caches.open(CACHE);
  const v = `?v=${encodeURIComponent(version)}`;
  for (const req of await cache.keys()) if (req.url !== manifestUrl && !req.url.endsWith(v)) await cache.delete(req);
}

/** Entpackt gzip; falls der Server schon entpackt geliefert hat (Content-Encoding), unverändert zurück. */
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function loadBundleFromUrl(base: string, progress: Progress = () => {}): Promise<GameData> {
  const url = (f: string) => new URL(f, base).toString();

  progress("Manifest");
  const manifestUrl = url(BUNDLE_FILES.manifest);
  const manifest = JSON.parse(new TextDecoder().decode(await manifestBytes(manifestUrl))) as Manifest;
  if (manifest.format !== BUNDLE_FORMAT) throw new Error(`Datenpaket-Format ${manifest.format}, erwartet ${BUNDLE_FORMAT}`);
  const bytes = (f: string) => cachedBytes(url(f), manifest.version);
  const json = async <T>(f: string) => JSON.parse(new TextDecoder().decode(await bytes(f))) as T;

  progress("Karten");
  const cardsFile = JSON.parse(new TextDecoder().decode(await gunzip(await bytes(BUNDLE_FILES.cards)))) as CardsFile;
  progress("Skripte");
  const [pack, index] = await Promise.all([gunzip(await bytes(BUNDLE_FILES.scriptPack)), json<Record<string, [number, number]>>(BUNDLE_FILES.scriptIndex)]);
  progress("Banlisten und Texte");
  const [lflists, strings] = await Promise.all([json<GameData["lflists"]>(BUNDLE_FILES.lflists), json<GameData["strings"]>(BUNDLE_FILES.strings)]);

  pruneCache(manifest.version, manifestUrl).catch(() => {});
  return {
    manifest,
    cards: new Map(cardsFile.cards.map((c) => [c.id, c])),
    scripts: new PackScriptSource(pack, index),
    lflists,
    strings,
  };
}
