# ocgcore-Nachrichtentypen und Umsetzungsstand

Quelle: `ygopro-core/common.h` (Stand `baa3881`), Parser: `ocgcore-wasm` 0.1.6 (`src/messages.ts`).

Legende Spalte „UI“: ⬜ offen · ✅ umgesetzt · ➖ keine eigene UI nötig.

**Stand Schritt 2:** Alle 21 Anfragetypen sind im UI-neutralen Auswahlmodell umgesetzt
(`src/engine/prompts.ts`) und in der Konsole bedienbar (`npm run duel`). Die Spalte „UI“ bezieht sich auf
die mobile Oberfläche (Schritt 4). Für Informations-Nachrichten gibt es Textzeilen in `src/engine/describe.ts`.

Besonderheiten aus den Tests:
- `SELECT_PLACE`, `SELECT_POSITION`, `ANNOUNCE_NUMBER`: Der vorangehende Hinweis (HINT/SELECTMSG) ist oft ein
  **Kartencode**, kein Text.
- `SORT_CARD`/`SORT_CHAIN`: In ocgcore-wasm 0.1.6 fehlerhaft serialisiert → lokaler Patch
  (`patches/ocgcore-wasm+0.1.6.patch`), Regressionstest mit „Card Advance“.
- `ANNOUNCE_NUMBER`: Antwort ist der **Index** der Option, nicht die Zahl.
- `SELECT_SUM`: Gültigkeitsprüfung 1:1 aus dem Kern übernommen (`checkSum`).
Spalte „Parser“: ✅ = von ocgcore-wasm typisiert geliefert.

## Anfragen (brauchen eine Antwort → bedienbare Oberfläche)

| Nr | Nachricht | Bedeutung | Parser | UI |
|---|---|---|---|---|
| 10 | SELECT_BATTLECMD | Kampfphase: angreifen / Effekt / M2 / EP | ✅ | ⬜ |
| 11 | SELECT_IDLECMD | Main Phase: NS, SS, Setzen, Effekt, Position, BP, EP | ✅ | ⬜ |
| 12 | SELECT_EFFECTYN | Optionalen Effekt (meist Auslöser) aktivieren? | ✅ | ⬜ |
| 13 | SELECT_YESNO | Ja/Nein-Frage mit Text | ✅ | ⬜ |
| 14 | SELECT_OPTION | Effekt-/Optionswahl | ✅ | ⬜ |
| 15 | SELECT_CARD | Karte(n) wählen (min/max, ggf. abbrechbar) | ✅ | ⬜ |
| 16 | SELECT_CHAIN | Kettenglied hinzufügen oder passen (oft leer → Auto-Pass) | ✅ | ⬜ |
| 18 | SELECT_PLACE | Zone wählen (inkl. Extra Monster Zone) | ✅ | ⬜ |
| 19 | SELECT_POSITION | Kampfposition wählen | ✅ | ⬜ |
| 20 | SELECT_TRIBUTE | Tribut wählen | ✅ | ⬜ |
| 21 | SORT_CHAIN | Reihenfolge gleichzeitiger Auslöser | ✅ | ⬜ |
| 22 | SELECT_COUNTER | Zählmarken entfernen/verteilen | ✅ | ⬜ |
| 23 | SELECT_SUM | Summen-Auswahl (Stufen, z. B. Ritual/Synchro) | ✅ | ⬜ |
| 24 | SELECT_DISFIELD | Zone(n) unbrauchbar machen | ✅ | ⬜ |
| 25 | SORT_CARD | Karten sortieren (z. B. Deckoberseite) | ✅ | ⬜ |
| 26 | SELECT_UNSELECT_CARD | Mehrfachauswahl mit An-/Abwählen + Fertig | ✅ | ⬜ |
| 132 | ROCK_PAPER_SCISSORS | Schere-Stein-Papier | ✅ | ⬜ |
| 140 | ANNOUNCE_RACE | Typ ansagen | ✅ | ⬜ |
| 141 | ANNOUNCE_ATTRIB | Eigenschaft ansagen | ✅ | ⬜ |
| 142 | ANNOUNCE_CARD | Kartennamen ansagen (Opcode-Filter) | ✅ | ⬜ |
| 143 | ANNOUNCE_NUMBER | Zahl ansagen | ✅ | ⬜ |

Zusätzliche Antwortart ohne eigene Nachricht: `SELECT_CARD_CODES` (Variante von SELECT_CARD).

## Informationen (Feldmodell, Kettenanzeige, Protokoll, Animation)

| Nr | Nachricht | Verwendung | Parser | UI |
|---|---|---|---|---|
| 1 | RETRY | Ungültige Antwort → Fehler anzeigen, erneut fragen | ✅ | ⬜ |
| 2 | HINT | Hinweistexte (Systemstring/Kartenstring) für die nächste Auswahl | ✅ | ⬜ |
| 5 | WIN | Duellende | ✅ | ⬜ |
| 30 | CONFIRM_DECKTOP | Deckoberseite zeigen | ✅ | ⬜ |
| 31 | CONFIRM_CARDS | Karten zeigen (z. B. gesuchte Karte) | ✅ | ⬜ |
| 32–39 | SHUFFLE_DECK/HAND/EXTRA/SET_CARD, REFRESH_DECK, SWAP_GRAVE_DECK, REVERSE_DECK, DECK_TOP | Feldmodell | ✅ | ⬜ |
| 40 | NEW_TURN | Zug-Anzeige, Protokoll | ✅ | ⬜ |
| 41 | NEW_PHASE | Phasen-Anzeige | ✅ | ⬜ |
| 42 | CONFIRM_EXTRATOP | Extra-Deck-Oberseite zeigen | ✅ | ⬜ |
| 50 | MOVE | Kartenbewegung (Kern des Feldmodells + Protokoll) | ✅ | ⬜ |
| 53–56 | POS_CHANGE, SET, SWAP, FIELD_DISABLED | Feldmodell | ✅ | ⬜ |
| 60–65 | SUMMONING/SUMMONED, SPSUMMONING/SPSUMMONED, FLIPSUMMONING/FLIPSUMMONED | Protokoll | ✅ | ⬜ |
| 70–76 | CHAINING, CHAINED, CHAIN_SOLVING, CHAIN_SOLVED, CHAIN_END, CHAIN_NEGATED, CHAIN_DISABLED | Kettenanzeige | ✅ | ⬜ |
| 80/81 | CARD_SELECTED, RANDOM_SELECTED | Hervorhebung | ✅ | ⬜ |
| 83 | BECOME_TARGET | Ziel-Markierung | ✅ | ⬜ |
| 90 | DRAW | Feldmodell, Protokoll | ✅ | ⬜ |
| 91/92/94/100 | DAMAGE, RECOVER, LPUPDATE, PAY_LPCOST | LP-Anzeige | ✅ | ⬜ |
| 93 | EQUIP | Ausrüstungsbeziehung | ✅ | ⬜ |
| 96/97 | CARD_TARGET, CANCEL_TARGET | Dauerhafte Zielbeziehung | ✅ | ⬜ |
| 101/102 | ADD_COUNTER, REMOVE_COUNTER | Zählmarken | ✅ | ⬜ |
| 110–114 | ATTACK, BATTLE, ATTACK_DISABLED, DAMAGE_STEP_START/END | Kampfanzeige | ✅ | ⬜ |
| 120 | MISSED_EFFECT | „Timing verpasst“-Hinweis | ✅ | ⬜ |
| 121–123 | BE_CHAIN_TARGET, CREATE_RELATION, RELEASE_RELATION | intern/Anzeige | ✅ | ⬜ |
| 130/131 | TOSS_COIN, TOSS_DICE | Ergebnis anzeigen | ✅ | ⬜ |
| 133 | HAND_RES | SSP-Ergebnis | ✅ | ⬜ |
| 160 | CARD_HINT | Karten-Hinweis (angesagte Karte usw.) | ✅ | ⬜ |
| 161 | TAG_SWAP | Tag-Duell (nicht genutzt) | ✅ | ➖ |
| 162 | RELOAD_FIELD | Feld komplett neu laden | ✅ | ⬜ |
| 163/164/165 | AI_NAME, SHOW_HINT, PLAYER_HINT | Hinweise | ✅ | ⬜ |
| 170 | MATCH_KILL | Match-Ende (nicht genutzt) | ✅ | ➖ |
| 180 | CUSTOM_MSG | Skript-Nachricht | ✅ | ⬜ |
| 190 | REMOVE_CARDS | Karten aus dem Spiel entfernen | ✅ | ⬜ |

## Vom Kern nie gesendet (Client/Server-Protokoll)

`WAITING (3)`, `START (4)`, `UPDATE_DATA (6)`, `UPDATE_CARD (7)`, `REQUEST_DECK (8)`, `UNEQUIP (95)` –
keine Fundstelle in den `.cpp`-Dateien des Kerns, vom Wrapper nicht geparst → keine UI nötig.
