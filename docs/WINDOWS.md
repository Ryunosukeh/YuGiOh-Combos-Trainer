# Windows-App (EXE)

Die Desktop-App ist eine schlanke Hülle ([Tauri 2](https://tauri.app), MIT/Apache-2.0) um dieselbe Web-App: gleicher
Regelkern, gleiche Oberfläche (am PC immer im Querformat-Layout). Sie nutzt den in Windows 10/11 eingebauten
WebView2 (Edge), deshalb ist sie klein (Installer ca. 3 MB, portable EXE ca. 5 MB).

## Herunterladen

Vorabversion **latest**: https://github.com/Ryunosukeh/YuGiOh-Combos-Trainer/releases/tag/latest

| Datei | |
|---|---|
| `combo-trainer-setup.exe` | Installation für den eigenen Benutzer (keine Adminrechte), Startmenü-Eintrag, Deinstallation über „Apps“ |
| `combo-trainer-portable.exe` | Ohne Installation starten (z. B. vom USB-Stick). Braucht WebView2, das in Windows 10/11 dabei ist |

## Warnung „Der Computer wurde durch Windows geschützt“

Die EXE ist **nicht code-signiert**. Ein Zertifikat kostet ca. 200–400 €/Jahr, für ein Hobbyprojekt lohnt sich das
nicht. Deshalb warnt Windows SmartScreen beim ersten Start: „Weitere Informationen“ → „Trotzdem ausführen“.
Das ist bei jeder unsignierten EXE so und kein Hinweis auf Schadcode. Wer sichergehen will: Die Datei entsteht
nachvollziehbar in der GitHub Action („CI“, Job `windows`) aus dem öffentlichen Quellcode.

## Daten und Offline

- Beim ersten Start lädt die App das Datenpaket (ca. 8 MB) von GitHub Pages und speichert es. Danach geht das
  Duell offline.
- Kartenbilder kommen von YGOPRODeck und landen im Browser-Cache von WebView2. Anders als in der Android-App und
  der PWA gibt es dafür keinen eigenen Dauerspeicher. Offline können lange nicht gesehene Bilder deshalb als
  Platzhalter erscheinen.
- Decks liegen lokal (IndexedDB im WebView2-Profil der App). Deinstallieren kann sie löschen → vorher exportieren.

## Selbst bauen

Voraussetzungen: Node.js ≥ 22.21, Rust (https://rustup.rs) und unter Windows die „C++ Build Tools“ von Visual Studio.

```bash
npm ci
npx tauri build --bundles nsis
```

Ergebnis: `src-tauri/target/release/combo-trainer.exe` und `src-tauri/target/release/bundle/nsis/*-setup.exe`.
Zum Entwickeln: `npx tauri dev` (startet den Vite-Dev-Server und ein App-Fenster).

## Technik

- `src-tauri/`: Rust-Hülle ohne eigene Befehle oder Plugins (`src/lib.rs`), Konfiguration in `tauri.conf.json`.
  Version kommt aus `package.json`.
- `src/platform.ts` erkennt die App (`isTauri`): Datenpaket von GitHub Pages, kein Service Worker, keine
  Ausrichtungs-Einstellung.
- Icons: `npm run icons` erzeugt auch `src-tauri/icons/` (über `tauri icon`).
