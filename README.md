# Yu-Gi-Oh! Combo-Trainer

Solo-Sandbox zum Üben von Yu-Gi-Oh!-Combos – mobil zuerst (Android/PWA), Regeln vollständig durch den
EDOPro-Regelkern [ygopro-core](https://github.com/edo9300/ygopro-core) (als WebAssembly) und die Kartenskripte
von [Project Ignis](https://github.com/ProjectIgnis/CardScripts). Kein KI-Gegner: Der Gegner ist ein passiver Dummy,
dem man optional Handtraps geben kann.

**Stand:** alle 7 Schritte umgesetzt. Regelkern, Deckbuilder mit Massen-Import, Duell-Oberfläche (Hoch-/Querformat),
Rückgängig, Combo-Protokoll, Gegner-Antworten (du entscheidest für seine Handtraps), PWA, Android-App und
Windows-EXE laufen. Details: [`CLAUDE.md`](CLAUDE.md), [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md).

- **Web-App / PWA:** https://ryunosukeh.github.io/YuGiOh-Combos-Trainer/
- **Android-APK und Windows-EXE:** [Vorabversion „latest“](https://github.com/Ryunosukeh/YuGiOh-Combos-Trainer/releases/tag/latest).
  Anleitungen: [`docs/ANDROID.md`](docs/ANDROID.md) (auch signierte Release-APK), [`docs/WINDOWS.md`](docs/WINDOWS.md)

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
