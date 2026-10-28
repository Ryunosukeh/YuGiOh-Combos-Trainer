// Spielt Aktionen über das Prompt-Modell, so wie ein Nutzer in der UI tippen würde (Tests, Systemcheck).
import { OcgMessageType } from "ocgcore-wasm";
import { buildPrompt, type MenuOption, type Prompt } from "./prompts";
import type { DuelSession } from "./session";

export class Driver {
  constructor(public session: DuelSession) {}

  /** Zonen- und Positionsabfragen mit der ersten Möglichkeit beantworten (für Combo-Tests ohne Zonenbezug). */
  skipPlacement() {
    for (;;) {
      const t = this.session.decision?.msg.type;
      if (t !== OcgMessageType.SELECT_PLACE && t !== OcgMessageType.SELECT_POSITION) return;
      const p = this.prompt;
      if (p.kind !== "menu") return;
      this.send(p.options[0].response);
    }
  }

  get prompt(): Prompt {
    const d = this.session.decision;
    if (!d) throw new Error("Keine offene Entscheidung (Duell beendet?)");
    const p = buildPrompt(d.msg, { data: this.session.data, hint: d.hint });
    if (!p) throw new Error(`Kein Prompt für Nachricht ${d.msg.type}`);
    return p;
  }

  private describe() {
    const p = this.prompt;
    if (p.kind === "menu") return `${p.title}: ${p.options.map((o) => o.label).join(" | ")}`;
    if (p.kind === "select") return `${p.title}: ${p.items.map((o) => o.label).join(" | ")}`;
    return p.title;
  }

  private send(r: Parameters<DuelSession["respond"]>[0]) {
    if (!this.session.respond(r)) throw new Error(`Antwort abgelehnt bei: ${this.describe()}`);
  }

  private choose(pred: (o: MenuOption) => boolean, what: string) {
    this.skipPlacement();
    const p = this.prompt;
    if (p.kind !== "menu") throw new Error(`${what}: erwartet Menü, bekam ${p.kind} (${this.describe()})`);
    const o = p.options.find(pred);
    if (!o) throw new Error(`${what}: nicht verfügbar. ${this.describe()}`);
    this.send(o.response);
  }

  /** Aktion in der Main Phase. `effect` = Index des Effekts der Karte (aux.Stringid(id, effect)). */
  idle(tag: "summon" | "spsummon" | "activate" | "mset" | "sset", code: number, effect?: number) {
    this.skipPlacement();
    this.passChains();
    const d = this.session.decision!;
    if (d.msg.type !== OcgMessageType.SELECT_IDLECMD) throw new Error(`erwartet Main-Phase-Auswahl, bekam ${this.describe()}`);
    const list = tag === "activate" ? d.msg.activates : null;
    this.choose((o) => {
      if (o.tag !== tag || o.card?.code !== code) return false;
      if (effect === undefined || !list) return true;
      const i = (o.response as { index: number }).index;
      return Number(list[i].description & 0xfn) === effect;
    }, `${tag} ${code}`);
  }

  /** Freiwillige Antwortmöglichkeiten (z. B. Schnellzauber auf der Hand) ablehnen. */
  passChains() {
    while (this.session.decision?.msg.type === OcgMessageType.SELECT_CHAIN && !this.session.decision.msg.forced)
      this.choose((o) => o.tag === "pass", "passen");
  }

  /** In die End Phase gehen. */
  endPhase() {
    this.passChains();
    this.choose((o) => o.label.includes("End Phase"), "End Phase");
  }

  /** Optionalen Effekt aktivieren – egal ob der Kern als Ja/Nein oder als Kettenauswahl fragt. */
  activate(code: number) {
    this.skipPlacement();
    const d = this.session.decision!;
    if (d.msg.type === OcgMessageType.SELECT_EFFECTYN) {
      if (d.msg.code !== code) throw new Error(`Ja/Nein für falsche Karte: ${this.describe()}`);
      return this.choose((o) => o.label === "Ja", `aktivieren ${code}`);
    }
    this.choose((o) => o.tag === "activate" && o.card?.code === code, `aktivieren ${code}`);
  }

  /** Karten wählen (SELECT_CARD/TRIBUTE/SUM oder schrittweise SELECT_UNSELECT_CARD). Optional mit Ort. */
  pick(...cards: (number | [number, number])[]) {
    this.skipPlacement();
    const want = cards.map((c) => (Array.isArray(c) ? { code: c[0], loc: c[1] } : { code: c, loc: undefined }));
    const p = this.prompt;
    if (p.kind === "select") {
      const used = new Set<number>();
      const sel = want.map((w) => {
        const i = p.items.findIndex((it, j) => !used.has(j) && it.card?.code === w.code && (w.loc === undefined || it.card.location === w.loc));
        if (i < 0) throw new Error(`Karte ${w.code} nicht wählbar. ${this.describe()}`);
        used.add(i);
        return i;
      });
      if (!p.validate(sel)) throw new Error(`Auswahl ungültig. ${this.describe()}`);
      return this.send(p.build(sel));
    }
    // SELECT_UNSELECT_CARD: Karte für Karte, dann ggf. „Fertig“.
    for (const w of want) {
      if (this.session.decision?.msg.type !== OcgMessageType.SELECT_UNSELECT_CARD) throw new Error(`Mehrfachauswahl vorzeitig beendet vor ${w.code}`);
      this.choose((o) => o.tag === "select" && o.card?.code === w.code && (w.loc === undefined || o.card.location === w.loc), `wählen ${w.code}`);
    }
    if (this.session.decision?.msg.type === OcgMessageType.SELECT_UNSELECT_CARD) this.choose((o) => o.tag === "finish", "Fertig");
  }
}
