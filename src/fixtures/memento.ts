import { OcgLocation } from "ocgcore-wasm";
import type { Driver } from "../engine/driver";

// Testdeck aus dem Abnahmetest (Passcodes; deutsche Namen als Kommentar).
export const C = {
  Tatsunootoshigo: 81677154, // Mementotlanischer Tatsunootoshigo
  Angwitch: 54550967, // Mementotlanische Enghexe
  DarkBlade: 18165869, // Mementotlanische Dunkelklinge
  Shleepy: 50042011, // Mementotlanisches Schlafschaf
  Goblin: 17943271, // Mementotlanischer Goblin
  Ghattic: 52918032, // Mementotlanischer Dachbodengeist
  Mace: 81945676, // Mementotlanischer Stab
  Akihiron: 54207171, // Mementotlanischer Akihiron
  HornedDragon: 55272555, // Mementotlanisch-hörniger Drache
  CombinedCreation: 23288411, // Mementoal Tecuhtlica - Kombinierte Schöpfung
  DuggCharger: 24079759, // Goblin-Biker Dugg Angreifer
  AshBlossom: 14558127,
  DrollLockBird: 94145021,
  Fuwalos: 42141493, // Mulcharmy Fuwalos
  Purulia: 84192580, // Mulcharmy Purulia
  Mictlan: 43338320, // Mementomictlan
  BoneParty: 80722024, // Mementotlanische Knochenparty
  MementoFusion: 66518509, // Mementotlanische Fusion
  SuperPoly: 48130397, // Superpolymerisation
  GrandBreakout: 29111045, // Großer Ausbruch der Goblin-Biker
  GrandEntrance: 90711610, // Großer Auftritt der Goblin-Biker
  RadiantTyphoonVision: 20508881, // Glanztaifun-Vision
  MST: 5318639, // Mystischer Raum-Taifun
  ForbiddenChalice: 25789292, // Verbotener Kelch
  CreationKing: 14529511, // Mementomictlan Tecuhtlica - Schöpfungskönig
  TwinDragon: 19181420, // Mementotlanischer Zwillingsdrache
  Dragostapelia: 69946549,
  Garura: 11765832,
  Mudragon: 54757758,
  Berfomet: 69601012,
  GuardianChimera: 11321089,
  Dharc: 8264361,
  UnderworldGoddess: 98127546,
  Gorgon: 12067160,
  Masquerena: 65741786,
  LittleKnight: 29301450,
  TyPhon: 93039339,
} as const;

const n = (code: number, count: number) => Array<number>(count).fill(code);

export const mementoDeck = {
  main: [
    ...n(C.Tatsunootoshigo, 3), ...n(C.Angwitch, 3), ...n(C.DarkBlade, 3), ...n(C.Shleepy, 2), ...n(C.Goblin, 2),
    C.Ghattic, C.Mace, C.Akihiron, C.HornedDragon, C.CombinedCreation, C.DuggCharger, ...n(C.AshBlossom, 2),
    C.DrollLockBird, C.Fuwalos, C.Purulia, C.Mictlan, ...n(C.BoneParty, 3), ...n(C.MementoFusion, 3),
    ...n(C.SuperPoly, 3), ...n(C.GrandBreakout, 3), C.GrandEntrance, ...n(C.RadiantTyphoonVision, 2), C.MST, C.ForbiddenChalice,
  ],
  extra: [
    ...n(C.CreationKing, 3), C.TwinDragon, C.Dragostapelia, C.Garura, C.Mudragon, C.Berfomet, C.GuardianChimera,
    C.Dharc, C.UnderworldGoddess, C.Gorgon, C.Masquerena, C.LittleKnight, C.TyPhon,
  ],
};

/** Die Abnahme-Combo aus der Aufgabenstellung, Schritt für Schritt. */
export function playAcceptanceCombo(d: Driver) {
  const G = OcgLocation.GRAVE, H = OcgLocation.HAND, M = OcgLocation.MZONE;
  // 1. NS Enghexe → sucht Tatsunootoshigo
  d.idle("summon", C.Angwitch);
  d.activate(C.Angwitch);
  d.pick(C.Tatsunootoshigo);
  // 2. Tatsunootoshigo von der Hand beschwören (Effekt 1)
  d.idle("activate", C.Tatsunootoshigo, 0);
  // 3. Tatsu-Effekt: sich zerstören → Dachbodengeist + Goblin + Stab in den Friedhof
  d.idle("activate", C.Tatsunootoshigo, 1);
  d.pick(C.Tatsunootoshigo);
  d.pick(C.Ghattic, C.Goblin, C.Mace);
  // 4. Dachbodengeist beschwört sich selbst → holt Tatsunootoshigo zurück
  d.activate(C.Ghattic);
  d.activate(C.Ghattic);
  d.pick(C.Tatsunootoshigo);
  // 5. Enghexe ②: sich zerstören → Stab aus dem Friedhof beschwören
  d.idle("activate", C.Angwitch, 1);
  d.pick(C.Mace);
  d.pick(C.Angwitch);
  // 6. Stab: Dachbodengeist zerstören → sucht Mementotlanische Fusion
  d.idle("activate", C.Mace, 1);
  d.pick(C.Ghattic);
  d.pick(C.MementoFusion);
  // 7. Fusion: Schöpfungskönig aus Enghexe (Friedhof), Tatsunootoshigo (Hand), Stab (Feld)
  d.idle("activate", C.MementoFusion);
  d.pick(C.CreationKing);
  d.pick([C.Angwitch, G], [C.Tatsunootoshigo, H], [C.Mace, M]);
  // 8. Schöpfungskönig legt Schöpfungskönig, Kombinierte Schöpfung, Akihiron in den Friedhof
  d.activate(C.CreationKing);
  d.pick(C.CreationKing, C.CombinedCreation, C.Akihiron);
  // 9. Schöpfungskönig aus dem Friedhof verbannen → Mementomictlan suchen und aktivieren
  d.idle("activate", C.CreationKing, 0);
  d.pick(C.Mictlan);
  d.idle("activate", C.Mictlan);
  // 10. Kombinierte Schöpfung aus dem Friedhof beschwören (5 verschiedene Memento-Monster zurückmischen)
  d.idle("spsummon", C.CombinedCreation);
  d.pick(C.Goblin, C.Ghattic, C.Tatsunootoshigo, C.Mace, C.Akihiron);
  // 11. End Phase: Mictlan setzt Mementotlanische Fusion
  d.endPhase();
  d.activate(C.Mictlan);
  d.pick(C.MementoFusion);
  d.skipPlacement();
}

