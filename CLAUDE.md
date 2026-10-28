# CLAUDE.md – Projektstand

Yu-Gi-Oh! Combo-Sandbox: Solo-Duell gegen passiven Dummy zum Üben von Combos, mobil zuerst
(Android/PWA), Regeln komplett durch ygopro-core (WASM). Sprache der Doku und UI: Deutsch.

## Grundregeln
- Keine eigene Regel-Engine, keine eigenen Karteneffekte. Kern = `ocgcore-wasm`, Skripte = Project Ignis.
- Fehlt etwas oder ist es kaputt: melden + Alternativen vorschlagen, nicht still ersetzen.
- BabelCDB/LFLists/Bilder nie ins Repo (keine Lizenz bzw. © Konami).
- Ein Commit pro abgeschlossenem Teilschritt. Bei schwer umkehrbaren Entscheidungen fragen.
- Jede Oberfläche in Hoch- (360×800) und Querformat (800×360) testen.

## Stand
- [x] Schritt 1: Recherche → `docs/ARCHITEKTUR.md`, `docs/NACHRICHTEN.md`, `LICENSES.md`.
      Spike `research/combo-spike.mjs` spielt die Abnahme-Combo headless komplett durch.
- [ ] Schritt 2: Headless-Duell (wartet auf OK zu Schritt 1)
- [ ] Schritt 3: Kartendaten + Deckbuilder + Massen-Import
- [ ] Schritt 4: Duell-UI mobil (Hoch + Quer)
- [ ] Schritt 5: Rückgängig + Combo-Protokoll
- [ ] Schritt 6: PWA + Android-APK
- [ ] Schritt 7: Gegner-Antworten, Tauri-EXE, CI

## Entscheidungen
- Kern: `ocgcore-wasm` 0.1.6 (npm), **sync**-Variante im Web Worker.
- Rückgängig = Neuabspielen (Seed + Antwortprotokoll); Auto-Antworten werden nicht protokolliert.
- Optionale Einzel-Auslöser kommen als `SELECT_EFFECTYN`; leere `SELECT_CHAIN` werden auto-gepasst.
- `setcode` aus cards.cdb als BigInt lesen (64 Bit).

## Offene Punkte (siehe ARCHITEKTUR.md §9)
- E1 Hosting des Daten-Bundles · E2 YGOPRODeck in Cloud-Umgebung gesperrt · E3 GitHub-Repo · E4 React/Svelte

## Spike ausführen
```bash
npm i ocgcore-wasm@0.1.6   # in einem Arbeitsordner
node --no-warnings research/combo-spike.mjs <ordner mit CardScripts/ und BabelCDB/>
```
