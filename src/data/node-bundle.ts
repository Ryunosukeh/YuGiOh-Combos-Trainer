// Lädt das Daten-Bundle aus einem Verzeichnis (nur Node: Konsole, Tests, Build-Skripte).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { PackScriptSource, type GameData } from "../engine/data";
import { BUNDLE_FILES, BUNDLE_FORMAT, type CardsFile, type Manifest } from "./types";

export const DEFAULT_BUNDLE_DIR = path.resolve("data/bundle");

export function bundleExists(dir = DEFAULT_BUNDLE_DIR) {
  return existsSync(path.join(dir, BUNDLE_FILES.manifest));
}

export function loadBundle(dir = DEFAULT_BUNDLE_DIR): GameData {
  if (!bundleExists(dir)) throw new Error(`Kein Datenpaket in ${dir} – zuerst „npm run update-data“ ausführen`);
  const read = (f: string) => readFileSync(path.join(dir, f));
  const manifest = JSON.parse(read(BUNDLE_FILES.manifest).toString()) as Manifest;
  if (manifest.format !== BUNDLE_FORMAT) throw new Error(`Datenpaket hat Format ${manifest.format}, erwartet ${BUNDLE_FORMAT}`);
  const cardsFile = JSON.parse(gunzipSync(read(BUNDLE_FILES.cards)).toString()) as CardsFile;
  return {
    manifest,
    cards: new Map(cardsFile.cards.map((c) => [c.id, c])),
    scripts: new PackScriptSource(gunzipSync(read(BUNDLE_FILES.scriptPack)), JSON.parse(read(BUNDLE_FILES.scriptIndex).toString())),
    lflists: JSON.parse(read(BUNDLE_FILES.lflists).toString()),
    strings: JSON.parse(read(BUNDLE_FILES.strings).toString()),
  };
}
