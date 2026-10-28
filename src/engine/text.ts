// Deutsche Bezeichnungen für Orte, Phasen, Positionen usw.
import { OcgAttribute, OcgLocation, OcgPhase, OcgPosition, OcgRace } from "ocgcore-wasm";

export function locationName(loc: number): string {
  if (loc & OcgLocation.OVERLAY) return "Xyz-Material";
  switch (loc) {
    case OcgLocation.DECK: return "Deck";
    case OcgLocation.HAND: return "Hand";
    case OcgLocation.MZONE: return "Monsterzone";
    case OcgLocation.SZONE: return "Zauber-/Fallenzone";
    case OcgLocation.GRAVE: return "Friedhof";
    case OcgLocation.REMOVED: return "Verbannt";
    case OcgLocation.EXTRA: return "Extra Deck";
    default: return `Ort ${loc}`;
  }
}

/** Zonenname inkl. Nummer, z. B. „Monsterzone 3“, „Extra Monster Zone links“, „Feldzone“. */
export function zoneName(location: number, sequence: number): string {
  if (location === OcgLocation.MZONE) {
    if (sequence === 5) return "Extra Monster Zone links";
    if (sequence === 6) return "Extra Monster Zone rechts";
    return `Monsterzone ${sequence + 1}`;
  }
  if (location === OcgLocation.SZONE) {
    if (sequence === 5) return "Feldzone";
    if (sequence === 6 || sequence === 7) return `Pendelzone ${sequence === 6 ? "links" : "rechts"}`;
    return `Zauber-/Fallenzone ${sequence + 1}`;
  }
  return locationName(location);
}

export function phaseName(phase: number): string {
  switch (phase) {
    case OcgPhase.DRAW: return "Draw Phase";
    case OcgPhase.STANDBY: return "Standby Phase";
    case OcgPhase.MAIN1: return "Main Phase 1";
    case OcgPhase.BATTLE_START: return "Battle Phase";
    case OcgPhase.BATTLE_STEP: return "Battle Step";
    case OcgPhase.DAMAGE: return "Damage Step";
    case OcgPhase.DAMAGE_CAL: return "Schadensberechnung";
    case OcgPhase.BATTLE: return "Ende der Battle Phase";
    case OcgPhase.MAIN2: return "Main Phase 2";
    case OcgPhase.END: return "End Phase";
    default: return `Phase ${phase}`;
  }
}

export function positionName(pos: number): string {
  switch (pos) {
    case OcgPosition.FACEUP_ATTACK: return "offener Angriff";
    case OcgPosition.FACEDOWN_ATTACK: return "verdeckter Angriff";
    case OcgPosition.FACEUP_DEFENSE: return "offene Verteidigung";
    case OcgPosition.FACEDOWN_DEFENSE: return "verdeckte Verteidigung";
    default: return `Position ${pos}`;
  }
}

const ATTRIBUTES: [number, string][] = [
  [OcgAttribute.EARTH, "ERDE"], [OcgAttribute.WATER, "WASSER"], [OcgAttribute.FIRE, "FEUER"],
  [OcgAttribute.WIND, "WIND"], [OcgAttribute.LIGHT, "LICHT"], [OcgAttribute.DARK, "FINSTERNIS"],
  [OcgAttribute.DIVINE, "GÖTTLICH"],
];
export const attributeList = ATTRIBUTES;

const RACES: [bigint, string][] = [
  [OcgRace.WARRIOR, "Krieger"], [OcgRace.SPELLCASTER, "Hexer"], [OcgRace.FAIRY, "Fee"], [OcgRace.FIEND, "Unterweltler"],
  [OcgRace.ZOMBIE, "Zombie"], [OcgRace.MACHINE, "Maschine"], [OcgRace.AQUA, "Aqua"], [OcgRace.PYRO, "Pyro"],
  [OcgRace.ROCK, "Fels"], [OcgRace.WINGEDBEAST, "Geflügeltes Ungeheuer"], [OcgRace.PLANT, "Pflanze"], [OcgRace.INSECT, "Insekt"],
  [OcgRace.THUNDER, "Donner"], [OcgRace.DRAGON, "Drache"], [OcgRace.BEAST, "Ungeheuer"], [OcgRace.BEASTWARRIOR, "Ungeheuer-Krieger"],
  [OcgRace.DINOSAUR, "Dinosaurier"], [OcgRace.FISH, "Fisch"], [OcgRace.SEASERPENT, "Seeschlange"], [OcgRace.REPTILE, "Reptil"],
  [OcgRace.PSYCHIC, "Psi"], [OcgRace.DIVINE, "Göttliches Ungeheuer"], [OcgRace.CREATORGOD, "Schöpfergott"], [OcgRace.WYRM, "Wyrm"],
  [OcgRace.CYBERSE, "Cyberse"], [OcgRace.ILLUSION, "Illusion"],
];
export const raceList = RACES;
