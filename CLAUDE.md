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
- [x] Schritt 2: Headless-Duell – Datenpaket (`npm run update-data`), GitHub Action → Pages, Engine
      (`src/engine/`), Konsole (`npm run duel`), Browser-Systemcheck, 7 Tests inkl. Abnahme-Combo.
- [x] Schritt 3: Kartensuche (DE/EN, unscharf), Kartenansicht, Deckbuilder (Main/Extra/Side, TCG-Banliste),
      Massen-Import mit Vorschau, .ydk/ydke, Deckverwaltung (IndexedDB), Hoch-/Querformat. 30 Vitest + 10 Playwright.
- [x] Schritt 4: Duell-UI mobil (Hoch + Quer): Spielfeld mit Kartenbildern, Hand-Leiste, leuchtende Aktionen,
      Auswahlfenster für alle 21 Anfragen, Kette, Verlauf, Stapelansicht, Rückgängig, Duell-Start mit Testhand/Seed.
      Abnahme-Combo komplett über die Oberfläche als Playwright-Test (hoch + quer).
- [ ] Schritt 5: Rückgängig + Combo-Protokoll
- [ ] Schritt 6: PWA + Android-APK
- [ ] Schritt 7: Gegner-Antworten, Tauri-EXE, CI

## Entscheidungen
- Kern: `ocgcore-wasm` 0.1.6 (npm), **sync**-Variante im Web Worker.
- Rückgängig = Neuabspielen (Seed + Antwortprotokoll); Auto-Antworten werden nicht protokolliert.
- Optionale Einzel-Auslöser kommen als `SELECT_EFFECTYN`; leere `SELECT_CHAIN` werden auto-gepasst.
- `setcode` aus cards.cdb als BigInt lesen (64 Bit).
- Kern mischt beim Start nicht → `DuelSession` mischt mit Seed (Host-Aufgabe wie beim EDOPro-Server).
- ocgcore-wasm 0.1.6 hat einen SORT_CARD-Fehler → `patches/ocgcore-wasm+0.1.6.patch` (postinstall). Bei
  Versionswechsel prüfen, ob der Patch noch nötig ist (Test „Karten sortieren“).
- Antwortprotokoll enthält nur Nutzerentscheidungen; Auto-Antworten (leere Fenster, Dummy) sind deterministisch.
- UI-Regel: Komponenten nie je nach Ausrichtung austauschen, nur per CSS-Klasse umgestalten. Dann bleibt beim
  Drehen alles eingehängt (Eingaben, Scroll, offene Dialoge). Reiter im Hochformat: inaktiver Bereich
  `visibility: hidden`, nicht `display: none` (sonst geht die Scrollposition verloren).
- Tippflächen ≥ 44 px – wird in jedem Playwright-Test automatisch geprüft (`checkLayout`), ebenso kein
  waagerechtes Scrollen.
- Kartenbilder: `<img>` von images.ygoprodeck.com (kein CORS → kein fetch möglich), Service Worker speichert
  jedes Bild beim ersten Laden (Cache First, opake Antworten). Tests blockieren YGOPRODeck-Bilder.
- Import-Status: exakt (normalisierter Name DE/EN) = sicher; sonst unsicher mit vorausgewähltem besten
  Vorschlag (Ähnlichkeit ≥ 0,45, auch Namensanfang); darunter „nicht gefunden“.
- Banliste: Plus sperrt nur bei 3 Exemplaren; Verstöße gegen die Liste meldet die Deckprüfung.
- Beschreibungen des Kerns: `aux.Stringid(code, n)` = `code << 20 | n` (Project Ignis utility.lua), Code 0 =
  Systemtext n. Manche Hinweise sind reine Kartencodes. → `splitDescription`/`describeString` in data.ts.
- Effekttexte (`str1..16`) gibt es nur englisch → Anzeige „Effekt n: …“, passend zu ①② im deutschen Kartentext.
- Duell läuft im Web Worker (`src/worker/`); Oberfläche baut Prompts selbst aus der Nachricht (Funktionen sind
  nicht übertragbar). Feld = Abfrage nach jeder Entscheidung (`engine/view.ts`), nicht aus MOVE nachgebaut.
- Duell-Sicherung: Konfiguration + Antworten in sessionStorage → Neuladen spielt neu ab.
- Kettenfenster: Standard „auto“ wie EDOPro (nur fragen, wenn `spe_count > 0`), wählbar „all“. Teil der
  Duell-Konfiguration, damit Neuabspielen deterministisch bleibt.
- Zonenwahl: Auswahlfenster startet eingeklappt, leuchtende Zone auf dem Feld antippen.
- Vorschaubilder in Knöpfen `aria-hidden`, sonst landet der Alt-Text im Knopfnamen.
- Prompt-Modell (`prompts.ts`) ist die einzige Stelle, die Kern-Anfragen in Auswahlmöglichkeiten übersetzt –
  Konsole, Tests und spätere UI nutzen es gemeinsam.

## Aufbau
- `scripts/update-data.ts` – Datenpaket bauen · `scripts/duel-cli.ts` – Konsole
- `src/app/` – Zustand (zustand, UI-Zustand in sessionStorage), Dexie-DB · `src/screens/` – Bildschirme
- `src/ui/` – Sheet (Bottom Sheet hoch / Seitenpanel quer), Hooks (Layout, langes Drücken, Scroll), Kartenbild
- `src/cards/` – Typzeile DE, Suche (MiniSearch + Levenshtein) · `src/deck/` – Import, Prüfung, .ydk, ydke
- `tests/e2e/` – Playwright in 360×800 und 800×360, Screenshots nach `test-results/screens/`
- `src/duel/` – Duell-Bildschirm, Feld, Hand, Auswahlfenster, Duell-Start · `src/worker/` – Duell-Worker
- `src/app/duel.ts` – Duell-Zustand (Worker-Kommunikation, Sicherung)
- `src/data/` – Bundle-Format, Node-Lader · `src/web/` – Browser-Lader, Kern im Browser
- `src/engine/` – Sitzung, Prompts, Autopilot, Texte · `src/deck/` – .ydk
- `src/fixtures/memento.ts` – Testdeck + Abnahme-Combo (Tests und Systemcheck)
- `tests/` – Vitest (braucht `data/bundle`, sonst übersprungen)

## Umgebung (Cloud-Session)
- Playwright: `@playwright/test` 1.63.0 passt zum vorinstallierten Chromium. Sichtprüfung mit echten Bildern nur
  mit `proxy: { server: $HTTPS_PROXY, bypass: "localhost" }` und `ignoreHTTPSErrors` (nicht in Tests).
- Hintergrund-Server (`vite preview`) nach Gebrauch per PID beenden (`ps … | grep '[v]ite preview'`).
- Node-`fetch` braucht hier den Proxy: `NODE_USE_ENV_PROXY=1 npm run update-data`.
- `pkill -f <muster>` nicht verwenden, wenn das Muster in der eigenen Befehlszeile steht.

## Offene Punkte
- Fehlermeldung an ocgcore-wasm (docs/upstream/) ist freigegeben, aber aus der Session nicht einreichbar
  (fremdes Repo) → Nutzer reicht per vorausgefülltem Link ein. Danach Issue-Link hier eintragen.

## Daten
- Deutsche Texte: YGOPRODeck zuerst, Lücken (Karten ab ~2023) aus Yugipedia (CC BY-SA 4.0), Cache in
  `.cache/yugipedia-de.json`, Auffrischung höchstens alle 6 Tage. Yugipedia: Passcodes 8-stellig mit
  führenden Nullen; Oder-Abfragen max. ~10 Werte; Offsets über ~10.000 springen zurück → nach Passcode blättern.
- Live-Seite: https://ryunosukeh.github.io/YuGiOh-Combos-Trainer/ (aus dieser Cloud-Umgebung nicht abrufbar).

## Entscheidungen aus ARCHITEKTUR.md §9
- E1 Daten-Bundle: wird per GitHub Action gebaut und mit der Web-App auf GitHub Pages ausgeliefert (nicht in die Git-Historie committet). Repo ist öffentlich → Pages kostenlos.
- E2 erledigt: YGOPRODeck freigegeben (API mit CORS `*`; Bilder-Host ohne CORS-Header → im Browser per <img>/Service Worker, in der App per nativem HTTP).
- E3 erledigt: https://github.com/Ryunosukeh/YuGiOh-Combos-Trainer (öffentlich, Branch `main`).
- E4 entschieden: React.

## Spike ausführen
```bash
npm i ocgcore-wasm@0.1.6   # in einem Arbeitsordner
node --no-warnings research/combo-spike.mjs <ordner mit CardScripts/ und BabelCDB/>
```
