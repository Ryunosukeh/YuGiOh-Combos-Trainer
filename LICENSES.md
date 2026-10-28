# Lizenzen der verwendeten Komponenten

Dieses Projekt steht unter der **GNU Affero General Public License v3.0** (`LICENSE`), weil es den
AGPL-lizenzierten Regelkern einbindet. Gedacht für private Nutzung.

| Komponente | Quelle | Lizenz | Wie genutzt | Im Repo? |
|---|---|---|---|---|
| ygopro-core (EDOPro-Kern) | https://github.com/edo9300/ygopro-core | AGPL-3.0 | als WASM in der App | nein (über npm-Paket) |
| ocgcore-wasm | https://github.com/n1xx1/ocgcore-wasm | MIT (Wrapper) + AGPL-3.0 (enthaltener Kern) + MIT (Lua 5.3) | npm-Abhängigkeit | nein |
| CardScripts | https://github.com/ProjectIgnis/CardScripts | AGPL-3.0 | zur Laufzeit/Build geladen | nein |
| Distribution (DE-Systemtexte) | https://github.com/ProjectIgnis/Distribution | AGPL-3.0 | `strings.conf` beim Build geladen | nein |
| BabelCDB (`cards.cdb`) | https://github.com/ProjectIgnis/BabelCDB | **keine Lizenzangabe** | beim Build geladen, nur lokal | **nein – nicht committen** |
| LFLists (Banlisten) | https://github.com/ProjectIgnis/LFLists | **keine Lizenzangabe** | beim Build geladen, nur lokal | **nein – nicht committen** |
| YGOPRODeck API (DE-Namen, Bilder) | https://ygoprodeck.com/api-guide/ | Nutzungsbedingungen von YGOPRODeck; Inhalte © Konami | einmal laden, lokal cachen, kein Hotlinking | nein |

Kartennamen, Kartentexte und Kartenbilder sind © Konami Digital Entertainment. Sie werden nur lokal
auf dem eigenen Gerät gespeichert und nicht mit der App verteilt.

Weitere npm-Abhängigkeiten (React, Vite, Dexie, MiniSearch, …) werden mit Schritt 2 ergänzt.
