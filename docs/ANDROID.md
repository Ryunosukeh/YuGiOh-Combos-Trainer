# Android-App und PWA

Es gibt zwei Wege aufs Handy. Beide nutzen denselben Code und dieselben Regeln (ygopro-core).

| | PWA (Browser) | Android-App (APK) |
|---|---|---|
| Installation | Seite öffnen → „Zum Startbildschirm hinzufügen“ | APK herunterladen und installieren |
| Updates | automatisch beim nächsten Start | neue APK drüberinstallieren |
| Ausrichtung festlegen | nur, wenn der Browser es erlaubt (meist nur installiert/Vollbild) | immer (Capacitor-Plugin) |
| Kartenbilder | Service Worker speichert jedes Bild beim ersten Anzeigen | App lädt jedes Bild einmal und speichert es (IndexedDB) |
| Datenpaket | von GitHub Pages, auf dem Gerät zwischengespeichert | ebenso (die APK enthält nur die App, keine Kartendaten) |

**Beide brauchen beim ersten Start Internet** (Datenpaket, ca. 10 MB). Danach funktioniert das Duell offline.
Kartenbilder, die noch nie angezeigt wurden, erscheinen offline als Platzhalter mit Kartennamen.

## PWA installieren

1. https://ryunosukeh.github.io/YuGiOh-Combos-Trainer/ in Chrome öffnen.
2. Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

## Debug-APK installieren (zum Ausprobieren)

Jeder Push auf `main` baut nach bestandenen Tests eine APK (GitHub Action „CI“, Job `android`). Sie wird zusammen mit
der Windows-EXE als Vorabversion **latest** veröffentlicht (bis Schritt 6 hieß sie `android-latest`):

https://github.com/Ryunosukeh/YuGiOh-Combos-Trainer/releases/tag/latest

1. Auf dem Handy die Seite öffnen und `combo-trainer-debug.apk` herunterladen.
2. Datei antippen. Android fragt beim ersten Mal, ob der Browser „Apps aus unbekannten Quellen“ installieren darf:
   erlauben (Einstellungen → Apps → Chrome → „Unbekannte Apps installieren“).
3. Play Protect warnt eventuell („unbekannter Entwickler“): „Trotzdem installieren“. Das ist bei jeder APK
   außerhalb des Play Store so.

Updates: neue APK herunterladen und drüberinstallieren. Decks und Einstellungen bleiben erhalten. Das klappt, weil
die Debug-APK immer mit demselben Debug-Schlüssel signiert wird (`android/app/debug.keystore`, liegt absichtlich im
Repo und ist kein Geheimnis).

Debug heißt hier: Die APK ist nicht für den Play Store gedacht und mit einem öffentlich bekannten Schlüssel signiert.
Jeder könnte also eine APK bauen, die sich als Update ausgibt. Für den eigenen Gebrauch ist das unkritisch. Zum
Weitergeben an andere taugt nur die signierte Release-APK.

## Signierte Release-APK

Einmalig einrichten (auf deinem PC, Java muss installiert sein, z. B. Temurin 21):

```bash
keytool -genkeypair -v -keystore combo-trainer-release.keystore -alias combotrainer -keyalg RSA -keysize 4096 -validity 10000
```

- Passwort gut merken und die Datei **sicher aufbewahren** (nicht ins Repo!). Geht sie verloren, lassen sich
  installierte Apps nicht mehr aktualisieren, sondern nur noch deinstallieren und neu installieren.
- Debug- und Release-APK haben dieselbe App-ID, aber verschiedene Schlüssel. Es kann immer nur eine von beiden
  installiert sein. Beim Wechsel einmal deinstallieren; dabei gehen die Decks verloren, also vorher exportieren
  (.ydk/ydke im Deckbuilder).

In GitHub hinterlegen (Repo → Settings → Secrets and variables → Actions → „New repository secret“):

| Secret | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Keystore als Base64: `base64 -w0 combo-trainer-release.keystore` (macOS: `base64 -i …`; Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("combo-trainer-release.keystore"))`) |
| `ANDROID_KEYSTORE_PASSWORD` | Passwort des Keystores |
| `ANDROID_KEY_ALIAS` | `combotrainer` (bzw. der gewählte Alias) |
| `ANDROID_KEY_PASSWORD` | Passwort des Schlüssels (bei PKCS12-Keystores = Keystore-Passwort) |

Ab dem nächsten Push enthält die Vorabversion **latest** zusätzlich `combo-trainer.apk`, die signierte Release-APK. Ohne die
Secrets wird nur die Debug-APK gebaut.

Lokal bauen (Android Studio bzw. Android SDK nötig):

```bash
npm ci
npm run build
npx cap sync android
cd android
ANDROID_KEYSTORE_FILE=/pfad/combo-trainer-release.keystore ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=combotrainer ANDROID_KEY_PASSWORD=… ./gradlew assembleRelease
```

Ergebnis: `android/app/build/outputs/apk/release/app-release.apk`. Für den Play Store bräuchte man stattdessen
`bundleRelease` (.aab) und ein Entwicklerkonto (einmalig 25 $). Das ist nicht eingerichtet.

## Technik

- Capacitor 8 (`capacitor.config.ts`, Ordner `android/`). Die Web-App (`dist/`) wird per `npx cap sync android` in
  die App kopiert. Der kopierte Inhalt ist nicht im Repo.
- Plattformunterschiede stehen gebündelt in `src/platform.ts`:
  - Datenpaket-URL (App: GitHub Pages)
  - Ausrichtung (`@capacitor/screen-orientation`)
  - Kartenbilder (nativ per `CapacitorHttp`, weil YGOPRODeck keine CORS-Header sendet; gespeichert in IndexedDB)
  - Zurück-Taste (`@capacitor/app`): zuerst wird das offene Fenster geschlossen, dann die Kartenansicht. Im Duell
    fragt die App nach, sonst geht es zur Deckliste und erst dort wird die App beendet.
- Der Service Worker läuft nur im Browser, nicht in der App.
- Ränder (Notch, Navigationsleiste): Capacitor setzt `--safe-area-inset-*`, die CSS nutzt sie vor `env(…)`.
- Icons und Startbild werden aus einem eigenen SVG-Motiv erzeugt: `npm run icons` (`scripts/icons.ts`).
- Versionsnummer der APK = Laufnummer der GitHub Action + 100 (steigt immer). Dadurch ist jede neue APK ein gültiges Update.
