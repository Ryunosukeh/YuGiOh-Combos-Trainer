# Yu-Gi-Oh! Combo-Trainer

Solo-Sandbox zum Üben von Yu-Gi-Oh!-Combos – mobil zuerst (Android/PWA), Regeln vollständig durch den
EDOPro-Regelkern [ygopro-core](https://github.com/edo9300/ygopro-core) (als WebAssembly) und die Kartenskripte
von [Project Ignis](https://github.com/ProjectIgnis/CardScripts). Kein KI-Gegner: Der Gegner ist ein passiver Dummy,
dem man optional Handtraps geben kann.

**Stand:** Schritt 2 von 7 – Regelkern, Datenpaket und Konsolen-Steuerung laufen. Deckbuilder und
Duell-Oberfläche folgen. Details: [`CLAUDE.md`](CLAUDE.md), [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md).

## Loslegen

```bash
npm install
npm run update-data     # Datenpaket bauen (Project Ignis + deutsche Texte von YGOPRODeck) → data/bundle/
npm test                # Engine-Tests inkl. Abnahme-Combo
npm run duel -- --hand 54550967 --seed 1234   # Duell in der Konsole (Testdeck: decks/memento-test.ydk)
npm run dev             # Web-App (Systemcheck) unter http://localhost:5173
```

Benötigt Node.js ≥ 22.21.

## Lizenz

AGPL-3.0 (wegen des eingebundenen Regelkerns), siehe [`LICENSE`](LICENSE) und [`LICENSES.md`](LICENSES.md).
Kartennamen, -texte und -bilder sind © Konami und werden nicht mit diesem Repo verteilt.
