# Yu-Gi-Oh! Combo-Trainer

Solo-Sandbox zum Üben von Yu-Gi-Oh!-Combos – mobil zuerst (Android/PWA), Regeln vollständig durch den
EDOPro-Regelkern [ygopro-core](https://github.com/edo9300/ygopro-core) (als WebAssembly) und die Kartenskripte
von [Project Ignis](https://github.com/ProjectIgnis/CardScripts). Kein KI-Gegner: Der Gegner ist ein passiver Dummy,
dem man optional Handtraps geben kann.

**Stand:** Schritt 6 von 7. Regelkern, Deckbuilder mit Massen-Import, Duell-Oberfläche (Hoch-/Querformat),
Rückgängig, Combo-Protokoll, PWA und Android-App laufen. Details: [`CLAUDE.md`](CLAUDE.md), [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md).

- **Web-App / PWA:** https://ryunosukeh.github.io/YuGiOh-Combos-Trainer/
- **Android-APK:** [Vorabversion „android-latest“](https://github.com/Ryunosukeh/YuGiOh-Combos-Trainer/releases/tag/android-latest).
  Installation und signierte Release-APK: [`docs/ANDROID.md`](docs/ANDROID.md)

## Loslegen

```bash
npm install
npm run update-data     # Datenpaket bauen (Project Ignis + deutsche Texte von YGOPRODeck) → data/bundle/
npm test                # Engine-Tests inkl. Abnahme-Combo
npm run duel -- --hand 54550967 --seed 1234   # Duell in der Konsole (Testdeck: decks/memento-test.ydk)
npm run dev             # Web-App unter http://localhost:5173
npm run test:e2e        # Oberflächentests in 360×800 und 800×360 (Screenshots in test-results/screens/)
```

Benötigt Node.js ≥ 22.21.

## Lizenz

AGPL-3.0 (wegen des eingebundenen Regelkerns), siehe [`LICENSE`](LICENSE) und [`LICENSES.md`](LICENSES.md).
Kartennamen, -texte und -bilder sind © Konami und werden nicht mit diesem Repo verteilt.
