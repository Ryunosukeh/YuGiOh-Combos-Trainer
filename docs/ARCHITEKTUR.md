# Architektur – Yu-Gi-Oh! Combo-Sandbox

Stand: 28.10.2026 · Schritt 1 abgeschlossen, Schritt 2 umgesetzt (siehe §12)

## TL;DR

- **Machbar.** Die komplette Abnahme-Combo (alle 11 Schritte) wurde bereits headless gegen den echten
  Regelkern mit den originalen Project-Ignis-Skripten durchgespielt (`research/combo-spike.mjs`,
  Ergebnis: „COMBO KOMPLETT“, 85 ms Laufzeit auf Desktop-Node). Kein Skriptfehler, keine Regelabweichung.
- **Regelkern:** `ocgcore-wasm` 0.1.6 (JSR `@n1xx1/ocgcore-wasm` **und** npm `ocgcore-wasm`, MIT-Wrapper um
  den AGPL-Kern von edo9300). Aktiv gepflegt, baut den aktuellen Core-Stand, ~960 KB WASM,
  parst alle Nachrichten, die der Kern tatsächlich sendet. **Kein Eigenbau mit Emscripten nötig.**
- **Drei echte Probleme**, die Entscheidungen von dir brauchen (Abschnitt 9):
  1. Ein Browser darf die Project-Ignis-Repos nicht als Archiv laden (CORS). 13.500 Einzeldateien
     sind keine Option. → Daten-Bundle nötig, Hosting-Frage.
  2. YGOPRODeck (API + Bilder) ist in **dieser Cloud-Umgebung gesperrt**; die deutsche Namensabdeckung
     konnte ich deshalb nicht live prüfen.
  3. BabelCDB und LFLists haben **keine Lizenz** → nicht ins Repo committen.

---

## 1. Geprüfte Komponenten

| Komponente | Quelle | Stand (geprüft) | Lizenz | Urteil |
|---|---|---|---|---|
| Regelkern (C++) | github.com/edo9300/ygopro-core | `baa3881`, 16.10.2026 | AGPL-3.0 | Referenzkern von EDOPro |
| WASM-Build | `ocgcore-wasm` (npm) / `@n1xx1/ocgcore-wasm` (JSR), github.com/n1xx1/ocgcore-wasm | 0.1.6, 19.10.2026 (letzter Commit 21.10.2026) | Wrapper MIT, enthält AGPL-Kern + Lua 5.3 (MIT) | **brauchbar, wird genutzt** |
| Kartenskripte | github.com/ProjectIgnis/CardScripts | `bc5d82d`, 28.10.2026 | AGPL-3.0 | 13.541 Skripte in `official/`, 30 MB roh / 4,9 MB gzip |
| Kartendatenbank | github.com/ProjectIgnis/BabelCDB `cards.cdb` | `2e6f985`, 27.10.2026 | **keine Lizenzdatei** | 14.759 Karten, 7,9 MB / 1,9 MB gzip, Englisch |
| Banlisten | github.com/ProjectIgnis/LFLists `0TCG.lflist.conf` | `481fec5`, aktuell „2026.10 TCG“ | **keine Lizenzdatei** | Format einfach (`passcode anzahl --name`) |
| Deutsche Systemtexte | github.com/ProjectIgnis/Distribution `config/languages/Deutsch/strings.conf` | aktuell | AGPL-3.0 (Repo) | „Wähle eine Karte zum Tributieren“ usw. – nützlich für Hinweistexte |
| Deutsche Kartennamen/-texte + Bilder | db.ygoprodeck.com/api/v7 (`language=de`), images.ygoprodeck.com | **nicht prüfbar** (Proxy 403) | Nutzungsbedingungen von YGOPRODeck; Inhalte © Konami | einzige Quelle für DE-Kartennamen, siehe Risiken |

Hinweis: Project Ignis bietet **keine** deutschen Kartennamen an (nur UI-Strings). Für deutsche
Kartennamen bleibt YGOPRODeck die einzige freie Quelle.

### ocgcore-wasm im Detail
- Zwei Varianten: **sync** (klassisch) und **JSPI** (async, nutzt JS Promise Integration).
- API: `createCore()`, `createDuel({seed, flags, cardReader, scriptReader, …})`, `loadScript`,
  `duelNewCard`, `startDuel`, `duelProcess`, `duelGetMessage` (liefert **typisierte** Objekte),
  `duelSetResponse` (nimmt **typisierte** Antworten), `duelQuery*`.
- Seed = 4×64-Bit (`[1n,1n,1n,1n]`) → deterministische Wiederholung, Grundlage für „Rückgängig“.
- Der Wrapper parst 89 der 95 Nachrichtentypen; die 6 fehlenden (`WAITING`, `START`, `UPDATE_DATA`,
  `UPDATE_CARD`, `REQUEST_DECK`, `UNEQUIP`) werden vom Kern **nie** gesendet (per grep geprüft) – sie
  sind Client/Server-Protokoll. Vollständige Liste: `docs/NACHRICHTEN.md`.
- Bekannter Bus-Faktor: Ein-Personen-Projekt. Fallback, falls es stirbt: selbst mit Emscripten bauen
  (das Repo enthält `scripts/build.sh`, MIT, wir können es forken).

## 2. Ergebnis des Machbarkeitstests (Spike)

`research/combo-spike.mjs` (Wegwerf-Code, kein App-Code): lädt `cards.cdb` (node:sqlite), alle Skripte
von Platte, baut das Testdeck aus Passcodes, legt Enghexe als Testhand direkt in die Hand
(`duelNewCard` mit `location: HAND`, `startingDrawCount: 0`), Gegner = 40 Vanilla-Karten, und spielt
die Combo über eine Plan-Liste. Alle 11 Schritte gehen durch, inkl. Fusion mit GY-Material,
Kombinierte Schöpfung (5 Namen zurückmischen) und Mictlans End-Phase-Setzen.

Erkenntnisse, die direkt in die Architektur einfließen:
1. **Optionale Einzel-Auslöser kommen als `SELECT_EFFECTYN`**, nicht als `SELECT_CHAIN`. Erst wenn
   mehrere Effekte gleichzeitig auslösen, kommt `SELECT_CHAIN` (+ ggf. `SORT_CHAIN`).
2. **Der Kern öffnet ständig leere Antwortfenster** (`SELECT_CHAIN` mit `selects: []`) für beide
   Spieler. Die UI muss diese automatisch passen (wie EDOPro), sonst tippt man sich tot.
   Einstellung „Bei jeder Antwortmöglichkeit fragen“ optional.
3. **Ignition-Effekte, die „sich selbst beschwören“** (Tatsunootoshigo), erscheinen unter
   `activates`, nicht unter `special_summons`. Ein Karten-Tap muss also Effekte **und** Beschwörungen
   zusammen anbieten. Effekte werden über `description` unterschieden (`aux.Stringid(id,n)` = `id*16+n`,
   Text steht in `cards.cdb` → `texts.str1..str16`).
4. **`SELECT_UNSELECT_CARD`** (Mehrfachauswahl mit Fertig-Knopf) wird für Fusionsmaterial, Tatsu-Effekt
   und Kombinierte Schöpfung genutzt; der Kern beendet die Auswahl selbst, wenn nichts mehr wählbar ist.
5. `setcode` in `cards.cdb` ist 64 Bit (bis zu 4 Archetypen à 16 Bit) → muss als BigInt gelesen werden.
6. Laufzeit ganze Combo: 85 ms, Core-Init 21 ms (Desktop). Auf einem Mittelklasse-Handy realistisch
   Faktor 5–10 → Rückgängig per Neuabspielen bleibt unter ~1 s.

## 3. Gesamtarchitektur

```
┌──────────────────────── UI-Thread (React) ─────────────────────────┐
│ Screens: Kartensuche · Deckbuilder · Duell · Einstellungen          │
│ Layouts: portrait/* und landscape/* (getrennte Komponenten)         │
│ State: Zustand-Store (serialisierbar → übersteht Drehen/Neuladen)   │
└──────────────▲─────────────────────────────────────────▲───────────┘
               │ postMessage (typisierte Nachrichten)    │
┌──────────────┴──────────── Duell-Worker ───────────────┴───────────┐
│ ocgcore-wasm (sync) · DuelSession: Seed + Antwortprotokoll         │
│ scriptReader: Map im Speicher (vorgeladen)                          │
│ AutoResponder: leere Fenster passen, Dummy-Gegner                   │
│ Feldmodell: aus MOVE/POS_CHANGE/... + duelQuery* abgeglichen        │
└──────────────▲─────────────────────────────────────────────────────┘
               │
┌──────────────┴─────────────── Datenschicht ────────────────────────┐
│ IndexedDB (Dexie): Karten (EN+DE), Decks, Einstellungen, Protokolle │
│ OPFS: Skript-Bundle, Bild-Cache (WebP/JPEG klein + groß)            │
│ Daten-Update: Bundle-Download + Delta-Abgleich                      │
└────────────────────────────────────────────────────────────────────┘
```

### 3.1 Duell-Worker
- Kern läuft in einem **Web Worker**, damit die UI auch bei langen Auflösungen flüssig bleibt.
- **Sync-Variante** statt JSPI: JSPI ist in Chromium (Android WebView, WebView2) verfügbar, aber nicht
  überall in Safari. Sync reicht, weil alle Skripte vor dem Duellstart im Speicher liegen.
- **Skripte vorladen:** Root-Skripte (`constant.lua`, `utility.lua`, `proc_*.lua`, …, ~0,5 MB) +
  Skripte aller Karten im Deck/Extra/Side/Gegnerhand + per Text-Scan referenzierte Codes
  (`Duel.LoadScript`, `Duel.LoadCardScript`, Token-/`CreateToken`-Codes). Falls zur Laufzeit ein
  Skript fehlt: synchroner Lesezugriff über **OPFS `FileSystemSyncAccessHandle`** (nur im Worker
  verfügbar, Chrome Android ≥ 108, Safari ≥ 15.2) auf ein indiziertes Gesamt-Bundle. Damit ist jede
  Karte jederzeit ladbar, ohne 30 MB Strings im RAM zu halten.
- **DuelSession** = `{ seed, deckSetup, testhand, firstPlayer, responses[] }`. Rückgängig:
  neues Duell mit gleichem Seed, Antworten 0..n-1 erneut einspielen. Automatische Antworten
  (Leerfenster, Dummy) werden **nicht** protokolliert, sondern deterministisch neu erzeugt.
  Zusätzlich: Snapshots sind im Kern nicht vorgesehen; Neuabspielen ist der saubere Weg.
- **Feldmodell:** Aus `MOVE`, `POS_CHANGE`, `SET`, `SWAP`, `DRAW`, `CHAINING`… wird der Zustand
  aufgebaut; nach jeder Anfrage zusätzlich `duelQueryField`/`duelQueryLocation` zum Abgleich
  (verhindert Drift, liefert ATK/DEF/Zähler/Overlay).
- **Spieler 1 (Dummy):** passt immer, geht in die End Phase. In Phase 2 (Handtraps): Bekommt er
  ein nicht-leeres `SELECT_CHAIN`/`SELECT_EFFECTYN`, wird **der Nutzer** gefragt („Gegner aktiviert
  Ash Blossom?“), sonst auto-pass. Das fällt aus der Architektur direkt heraus.

### 3.2 Nachrichten → UI
Jede Anfrage-Nachricht bekommt genau eine Komponente in `src/duel/prompts/` (21 Anfragetypen, siehe
`docs/NACHRICHTEN.md`). Gemeinsames Interface: `({msg, field, onRespond, onCancel?})`. Im
Hochformat gerendert als Bottom Sheet, im Querformat als Seitenpanel – gleiche Logik, anderer
Container. Informations-Nachrichten speisen Feldmodell, Kettenanzeige und Combo-Protokoll.

**Legale Aktionen sichtbar:** `SELECT_IDLECMD` und `SELECT_BATTLECMD` liefern alle möglichen Aktionen
mit Karte+Ort. Daraus wird pro Karte eine Aktionsliste gebaut → Karte hervorheben, Tap öffnet Menü
(NS / Setzen / SS / Effekt 1 / Effekt 2 …, Effektname aus `str1..str16`).

### 3.3 Combo-Protokoll
Generiert aus Nachrichten + Kontext der letzten Anfrage: `SUMMONING` → „NS Enghexe“, `SPSUMMONING` →
„SS Tatsunootoshigo“, `CHAINING` + nachfolgende `MOVE`s Deck→Hand → „Enghexe sucht Tatsunootoshigo“,
Deck→GY → „… legt X, Y, Z in den Friedhof“. Regelbasiert, nicht pro Karte gepflegt.

## 4. Datenpipeline

### 4.1 Problem
Ein Browser kann von GitHub nur Dateien mit CORS-Header laden. `raw.githubusercontent.com` hat
`Access-Control-Allow-Origin: *` (geprüft), Repo-Archive (`codeload`, `archive/*.zip`) nach meinem
Kenntnisstand **nicht** (in dieser Umgebung nicht prüfbar, Proxy blockt). 13.541 Skripte einzeln zu
laden ist unzumutbar.

### 4.2 Lösung (Empfehlung, Entscheidung offen)
- `npm run update-data` (Node, läuft lokal oder in GitHub Actions):
  1. `git clone --depth 1` von CardScripts, BabelCDB, LFLists, Distribution (DE-Strings).
  2. YGOPRODeck: einmal `cardinfo.php` (EN) und `cardinfo.php?language=de` laden, Zuordnung über Passcode.
  3. Baut `data/bundle/`:
     - `cards.json.gz` – kompakte Kartendaten (EN aus cdb, DE aus YGOPRODeck, Effekt-Strings `str1..16`)
     - `scripts.pack` + `scripts.idx` – alle Lua-Skripte in einer Datei mit Offset-Index (für OPFS-Sync-Lesen)
     - `lflist.json`, `strings.de.json`, `manifest.json` (Commit-Hashes, Datum, Größen, SHA-256)
  4. Bilder werden **nicht** gebündelt (siehe 5.).
- **App:** lädt beim ersten Start `manifest.json` + Bundle (~8 MB gzip gesamt) und legt alles in
  IndexedDB/OPFS. „Aktualisieren“ vergleicht `manifest.json`. Danach komplett offline.
- **Hosting des Bundles:** siehe offene Entscheidung E1.
- **Zusätzlich direkter Weg (ohne eigenes Hosting):** Für ein reines Skript-Update kann die App die
  geänderten Dateien seit dem Bundle-Commit über `api.github.com/repos/…/compare/A...B` ermitteln und
  einzeln von `raw.githubusercontent.com` holen (60 API-Requests/h ohne Token reichen dafür).
  In der Android-/Desktop-App gibt es keine CORS-Grenze (CapacitorHttp / Tauri-HTTP) – dort kann die
  App die Repos auch komplett selbst laden.

## 5. Deutsche Namen und Bilder (YGOPRODeck)

> **Problem (festgestellt in Schritt 2):** YGOPRODeck liefert deutsche Texte nur bis Mitte 2022.
> Von den Karten mit TCG-Erscheinungsjahr 2023–2026 haben **3 von ~2.300** einen deutschen Namen – das ganze
> Memento-Testdeck fehlt. Gesamt: 11.979 von 14.845 Karten mit deutschem Text. Für den DE-Massenimport
> braucht es eine zweite Quelle, siehe §12 „Offen“.
>
> **Gelöst:** Yugipedia ergänzt die Lücken (Semantic-MediaWiki-Abfrage über den Passcode, seitenweise
> nach Passcode geblättert, da Yugipedia Offsets und Oder-Abfragen begrenzt). Ergebnis: 14.489 von 14.845
> Karten mit deutschem Text; alle 37 Namen der Abnahme-Liste werden wörtlich erkannt (DE oder EN).
> Der Rest sind vor allem OCG-exklusive Karten. Yugipedia-Inhalte stehen unter CC BY-SA 4.0 → Namensnennung
> in LICENSES.md und später in der App.

Regeln laut YGOPRODeck-Doku (aus meinem Wissen, **in dieser Umgebung nicht live verifiziert**):
- Rate-Limit 20 Requests/Sekunde, bei Überschreitung Sperre (1 h).
- Bilder **einmal herunterladen und selbst speichern**, kein Hotlinking.
- API-Daten lokal cachen statt pro Suche abzufragen.
- `language=de` liefert nur Karten mit deutscher Übersetzung → Fallback auf EN-Name.

Umsetzung:
- Kartendaten: im Bundle (einmal pro Update ein Request EN + ein Request DE).
- Bilder: **pro Karte bei Bedarf**, nur für Karten in eigenen Decks + angesehene Karten.
  Klein (`cards_small`, für Feld/Hand/Liste) und groß (`cards`, für Detailansicht) getrennt.
  Gedrosselte Download-Queue (max. ~5/s), Ablage in OPFS/Cache Storage, `loading="lazy"`.
- Zuordnung immer über Passcode. Alt-Arts (`alias` in cdb) → Bild der Alt-Art, Daten/Skript des Originals.
- Bilder werden **nicht** ins Repo, nicht ins Bundle und nicht in die APK gelegt (© Konami).

## 6. Technikwahl

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache/Build | TypeScript, Vite | wie vorgegeben |
| UI | **React 19** | Größtes Ökosystem (Virtualisierung, Gesten, Bottom Sheets), Capacitor/Tauri-Beispiele, für mich am zuverlässigsten fehlerfrei zu schreiben. Svelte wäre ~30 KB kleiner, aber der Engpass liegt bei Bildern und Kern, nicht beim Framework. |
| State | Zustand (MIT) | klein, serialisierbar → Drehen/Neuladen ohne Verlust |
| Persistenz | Dexie (Apache-2.0) auf IndexedDB + OPFS | robust, gute Migrationen |
| Fuzzy-Suche | MiniSearch (MIT) für die Live-Suche, `fastest-levenshtein` (MIT) für Import-Abgleich | MiniSearch hat einen Index → schnell auf schwachen Handys bei 2×15k Namen; Fuse.js scannt linear |
| Listen | `@tanstack/react-virtual` (MIT) | Suchergebnisse/Friedhof virtualisiert |
| PWA | `vite-plugin-pwa` (Workbox, MIT) | Offline-App-Shell |
| Android | Capacitor 8 + `@capacitor/screen-orientation`, `@capacitor/app` | offizielles Orientation-Plugin, Zurück-Taste |
| Desktop | Tauri 2 (später) | WebView2 = Chromium, gleicher Codepfad |
| Tests | Vitest (Logik), Playwright (Screenshots 360×800 + 800×360, Combo-E2E) | |
| SQLite | nur im Build-Skript (`node:sqlite`/better-sqlite3), **nicht in der App** | spart ~1 MB WASM im Client |

## 7. Bildschirmausrichtung – was technisch geht

- **Android-App (Capacitor):** Sperre Hoch/Quer/Automatisch zuverlässig über das Plugin.
- **Browser/PWA:** `screen.orientation.lock()` funktioniert in Chrome Android **nur im Vollbild
  bzw. als installierte PWA** und in iOS Safari gar nicht. Umsetzung (Schritt 6): Die Optionen
  sind immer wählbar. Schlägt `lock()` fehl, erscheint ein Hinweis (installieren oder die App nutzen). Die Wahl
  bleibt gespeichert und greift, sobald es möglich ist.
- Layout-Umschaltung über `matchMedia('(orientation: landscape)')` + Mindestbreite; Tablets/Desktop
  immer Querformat-Layout. Zustand (offene Dialoge, Scroll, Eingaben) liegt im Store, nicht in
  Komponenten-State → überlebt den Wechsel des Layout-Baums.
- Safe Areas: `env(safe-area-inset-*)` + `viewport-fit=cover`, in beiden Ausrichtungen getestet. In der App
  zuerst `--safe-area-inset-*` (setzt Capacitor 8 selbst, weil `env()` in älteren Android-WebViews unzuverlässig ist).

## 8. Lizenzen (Kurzfassung, Details in LICENSES.md)

- Der Kern ist **AGPL-3.0** und wird in die App gelinkt → **die gesamte App ist AGPL-3.0**.
  Das Repo ist entsprechend lizenziert (`LICENSE`). Für private Nutzung unproblematisch; wer die App
  weitergibt oder als Website betreibt, muss den Quellcode anbieten.
- CardScripts, Distribution (DE-Strings): AGPL-3.0 – kompatibel.
- BabelCDB, LFLists: **ohne Lizenz** → rechtlich „alle Rechte vorbehalten“. Nur zur Laufzeit/Build
  herunterladen, nicht im Repo versionieren, nicht öffentlich weiterverteilen.
- YGOPRODeck-Daten und alle Kartentexte/-bilder: © Konami; Nutzungsbedingungen von YGOPRODeck.
  Nur privat, nur lokal gecacht.

## 9. Entscheidungen

Stand 28.10.2026: E2 erledigt (YGOPRODeck erreichbar, API mit CORS `*`, Bilder-Host ohne CORS-Header). E4: React. E1: Bundle wird von einer GitHub Action gebaut und zusammen mit der Web-App auf GitHub Pages ausgeliefert, nicht in die Git-Historie committet. E3: Repo `YuGiOh-Combos-Trainer` legt der Nutzer an.

Ursprüngliche Optionen:

**E1 – Wo liegt das Daten-Bundle?**
- (a) *Empfehlung:* GitHub Pages deines Repos, gebaut von einer geplanten GitHub Action (z. B.
  wöchentlich). Wenn die PWA auch dort liegt, ist es sogar same-origin. Nachteil: Skripte + cdb
  werden öffentlich gehostet (Skripte AGPL = ok; cdb ohne Lizenz = Grauzone, bei Privatnutzung
  praktisch irrelevant, aber sag mir, ob du das willst). Pages braucht ein öffentliches Repo (oder GitHub Pro).
- (b) Nur lokal: `npm run update-data` erzeugt das Bundle, das du per Datei-Import in die App lädst
  bzw. das beim Build in die App kopiert wird. Kein Hosting, aber Updates nur über neuen Build.
- (c) Nur native Apps laden direkt von GitHub (kein CORS); die Browser-Version bekommt (a) oder (b).

**E2 – Netzwerkzugriff dieser Umgebung:** Bitte `db.ygoprodeck.com` und `images.ygoprodeck.com`
in den erlaubten Domains der Cloud-Umgebung freigeben, sonst kann ich ab Schritt 3 die deutschen
Namen weder laden noch den DE-Massenimport testen. (Umgebungseinstellungen → Network access.)

**E3 – GitHub-Repo:** Das Projekt liegt aktuell nur lokal in dieser Session (`git init`). Für Commits,
die überleben, und für die Actions brauche ich ein Repo (Name? öffentlich/privat?).

**E4 – Framework:** React (Empfehlung) oder Svelte?

## 10. Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Gegenmaßnahme |
|---|---|---|---|
| `ocgcore-wasm` wird nicht mehr gepflegt | mittel | neue Core-Features fehlen | MIT-Fork + eigener Emscripten-Build (Skript vorhanden) |
| Neue Karten brauchen neueren Kern als das WASM | mittel | einzelne neue Karten fehlerhaft | Kern-Version im Manifest prüfen, Warnung anzeigen |
| YGOPRODeck ändert API/sperrt | niedrig–mittel | keine DE-Namen/Bilder | Daten liegen nach erstem Laden lokal; EN-Fallback aus cdb |
| DE-Namen fehlen/abweichend (z. B. „Goblin-Biker Dugg Angreifer“) | hoch | Import unsicher | Fuzzy-Abgleich DE+EN + Vorschlagsliste, ist eingeplant |
| Speicher auf schwachen Handys | mittel | Abstürze | Skripte nicht komplett im RAM (OPFS-Sync), kleine Bilder, Virtualisierung |
| Orientation-Lock im Browser | sicher | Sperre nur in App/Vollbild | dokumentiert, UI zeigt nur Mögliches |
| Leere Antwortfenster nerven | sicher | schlechte UX | Auto-Pass als Standard |
| Kartenskript-Bug in einer Combo | niedrig | Combo bricht | Spike-Harness als Regressionstest; Fehler an Project Ignis melden (Discord), nicht selbst patchen |

## 11. Nächster Schritt (nach OK)

Schritt 2 „Headless-Duell“: Projektgerüst (Vite+TS), `npm run update-data` (ohne YGOPRODeck-Teil, falls
E2 noch offen), Duell-Worker mit DuelSession/Replay, Konsolen-Steuerung (Node-CLI, die jede Anfrage
als nummerierte Optionen ausgibt), Abnahme-Combo als automatischer Vitest-Test.

## 12. Erkenntnisse aus Schritt 2 (Headless-Duell)

Umgesetzt:
- `npm run update-data` → `data/bundle/` (7,9 MB): `cards.json.gz` (cards.cdb + release-*.cdb, DE-Texte von
  YGOPRODeck), `scripts.pack.gz` + `scripts.idx.json` (13.567 Skripte als eine Datei mit Offset-Index),
  `lflists.json`, `strings.json` (System-Texte DE/EN aus Distribution), `manifest.json` (Commits, Hashes).
- GitHub Action `.github/workflows/pages.yml`: baut wöchentlich und bei jedem Push Datenpaket + Web-App,
  führt die Tests aus und veröffentlicht auf GitHub Pages. Das Paket kommt nie in die Git-Historie.
- Engine (`src/engine/`): `DuelSession` (Seed, Testhand, erster/zweiter Zug, Dummy-Gegner „passen“/„fragen“,
  Rückgängig per Neuabspielen, Lebenspunkte), `prompts.ts` (alle 21 Anfragetypen als UI-neutrales Modell),
  `autopilot.ts` (leere Kettenfenster, Dummy), `describe.ts` (Textzeilen).
- Konsole: `npm run duel`. Browser: Systemcheck-Seite lädt Paket + Kern und spielt die Abnahme-Combo
  (Chromium, 360×800 und 800×360: Laden ~0,7 s, Combo ~0,15 s).
- Tests (`npm test`): Abnahme-Combo, Determinismus, Rückgängig, ungültige Antwort, Seed/Starthand,
  Ash Blossom im Fragemodus, Sortieren.

Befunde:
1. **Der Kern mischt beim Start nicht** – das macht bei EDOPro der Server. Die Sitzung mischt Main Decks
   deshalb selbst mit einem Seed-basierten Zufallsgenerator (`seed.ts`), bevor die Karten eingelegt werden.
   Das ist Host-Aufgabe, keine Spielregel.
2. **Zonenwahl:** Der Kern fragt bei jeder Beschwörung/Aktivierung die Zone ab (`SELECT_PLACE`). Für Combos
   relevant (Link-Pfeile), daher bleibt es eine Nutzerentscheidung; eine Einstellung „Zone automatisch“
   kommt in Schritt 4.
3. **Kettenfenster mit Optionen:** Hat man einen Schnellzauber/Quick-Effekt, fragt der Kern nach jeder
   Auflösung. Korrektes Verhalten; die UI braucht dafür einen schnellen „Passen“-Knopf.
4. **Fehler in ocgcore-wasm 0.1.6:** `SORT_CARD`-Antworten werden mit falschem Längenbyte gesendet, der Kern
   lehnt jede Sortierung ab. Lokaler 1-Zeilen-Patch über `patch-package` (`patches/`), Regressionstest
   vorhanden, Fehlermeldung vorbereitet (`docs/upstream/ocgcore-wasm-sort-card.md`). Alle anderen
   Antwortformate habe ich gegen den Kern-Quelltext geprüft – sie stimmen.
5. **Lebenspunkte** liefert der Kern nicht per Abfrage; sie werden aus LPUPDATE/DAMAGE/RECOVER/PAY_LPCOST
   mitgeführt (wie EDOPro).
6. Hinweise (`HINT`/SELECTMSG) sind je nach Anfrage Systemtext, Kartentext (`code*16+n`) oder ein
   reiner Kartencode – `describeString` behandelt alle drei.

Erledigt nach Schritt 2:
- **Deutsche Kartennamen für Karten ab 2023** → Yugipedia (Option a, siehe §5). Geprüfte Kandidaten waren:
  (a) Yugipedia (Semantic-MediaWiki-API, Inhalte CC BY-SA 4.0, hat deutsche TCG-Namen),
  (b) db.ygoresources.com (Daten aus der offiziellen Konami-Datenbank, alle Sprachen, keine Lizenzangabe),
  (c) offizielle Konami-Kartendatenbank (Scraping, langsam, rechtlich am heikelsten).

## 13. Schritt 3 (Kartendaten, Deckbuilder, Massen-Import)

- **Suche:** MiniSearch-Index über deutsche und englische Namen (Präfix + Tippfehler-Toleranz), danach
  Rangfolge über normalisierte Schlüssel (klein, ä→ae, ohne Satzzeichen): exakt > Anfang > enthält > ähnlich.
  Ähnlichkeit berücksichtigt auch den Namensanfang („Ash Blosom“ → „Ash Blossom & Joyous Spring“).
- **Massen-Import:** „3x Name“, „3 Name“, „Name x3“, „Name 3x“, Aufzählungszeichen, Überschriften
  (Main/Extra/Side, deutsch und englisch), Kategorie-Zeilen („Monster (20)“) werden übersprungen,
  Extra-Deck-Monster automatisch zugeordnet, .ydk-Text und ydke://-Links erkannt. Namen, die selbst mit
  einer Zahl beginnen, werden zuerst als ganze Zeile geprüft. Die Abnahme-Liste wird zu 37/37 sicher erkannt.
- **Deckprüfung:** 40–60 / 0–15 / 0–15, max. 3 Exemplare (Alt-Arts zählen als Original), aktuelle
  TCG-Banliste aus LFLists, Extra-Deck-Karten nur im Extra Deck.
- **Speicherung:** Decks in IndexedDB (Dexie). Datenpaket versioniert in Cache Storage → zweiter Start
  ohne Download, offline nutzbar. Bedienzustand (Route, Reiter, Suche, offener Import) in sessionStorage.
- **Bilder:** siehe CLAUDE.md. Bewusster Kompromiss im Browser: Service Worker speichert opake Antworten;
  Chrome rechnet diese mit Polsterung auf das Speicherkontingent an. Bei ~100 Karten pro Deck unkritisch.
  Die Android-App lädt Bilder in Schritt 6 nativ herunter.

## 14. Schritt 4 (Duell-Oberfläche)

- **Feld:** 7 Spalten × 5 Reihen wie am Tisch (Gegner gespiegelt oben, Extra Monster Zonen in der Mitte,
  Friedhof/Verbannt/Deck/Extra als Stapel). Kartengröße per ResizeObserver aus dem verfügbaren Platz.
  Gegnerische verdeckte Karten und Hand bleiben verdeckt; eigene verdeckte Karten sind abgedunkelt sichtbar.
- **Bedienung:** In Main/Battle Phase leuchten Karten mit Aktionen (Hand, Feld, Stapel); Antippen öffnet die
  Aktionen, langes Drücken die große Kartenansicht. Phasenwechsel als Knöpfe. Alle anderen Anfragen im
  Auswahlfenster (einklappbar), Zonenwahl direkt auf dem Feld.
- **Worker:** Kern + Sitzung im Web Worker (66 KB + 0,96 MB WASM); die Oberfläche bekommt nach jeder
  Entscheidung eine serialisierbare Momentaufnahme (`DuelView`) und die neuen Nachrichten.
- **Befund:** Die Annahme „Beschreibung = code × 16 + n“ (altes YGOPro) war falsch; Project Ignis nutzt
  `code << 20 | n`. Erst die Oberflächentests haben das gezeigt (Engine-Tests verglichen nur die unteren Bits).
- **Befund:** Mit Schnellzaubern/Handtraps auf der Hand fragt der Kern nach jeder Auflösung. Lösung wie EDOPro:
  Fenster ohne passende Effekte (`spe_count = 0`) automatisch passen; umschaltbar beim Duellstart.

## 15. Schritt 5 (Combo-Protokoll, Rückgängig)

- **Protokoll:** eine Zeile pro Aktion bzw. aufgelöstem Effekt, Teilsätze in Ereignisreihenfolge
  („zerstört sich, SS Stab“), Kosten in Klammern, Fusions-/Synchro-/Xyz-/Link-Material erkannt. Grundlage ist
  der Bewegungsgrund aus MSG_MOVE – den verwirft ocgcore-wasm 0.1.6, der Patch liest ihn mit
  (Fehlermeldung ergänzt). Gegnerhand und gegnerische gesetzte Karten bleiben verdeckt.
- **Rückgängig:** „↶ Aktion“ nimmt eine komplette Aktion inkl. Zonenwahl/Zielen/Auslösern zurück,
  „↶ Schritt“ eine einzelne Antwort. Im offenen Auswahlfenster gibt es „↶“ in der Kopfzeile, weil das
  Fenster die Knöpfe sonst verdeckt (Befund aus den Oberflächentests).
- **Hintergründe:** Schlicht, Spielmatte (Standard), Nachtblau, Arkana, Holztisch – CSS-Verläufe, Zonen auf
  dunklen Matten mit hellen Rahmen.
