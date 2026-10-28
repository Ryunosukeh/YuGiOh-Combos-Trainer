// Systemcheck: spielt die Abnahme-Combo im Browser gegen den echten Regelkern.
import { useState } from "react";
import { useApp } from "../app/store";
import { Driver } from "../engine/driver";
import { DuelSession } from "../engine/session";
import { describeMessage } from "../engine/describe";
import { C, mementoDeck, playAcceptanceCombo } from "../fixtures/memento";
import { createBrowserCore } from "../web/core";

type Status = { kind: "idle" } | { kind: "running" } | { kind: "ok"; lines: string[] } | { kind: "error"; message: string };

export function SystemCheck() {
  const { data, set } = useApp();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function run() {
    if (!data) return;
    setStatus({ kind: "running" });
    try {
      const t0 = performance.now();
      const core = await createBrowserCore();
      const t1 = performance.now();
      const s = DuelSession.start(core, data, { deck: mementoDeck, seed: 1234, goFirst: true, hand: [C.Angwitch] });
      playAcceptanceCombo(new Driver(s));
      const t2 = performance.now();
      const log = s.history.map((m) => describeMessage(m, data, s.me)).filter((l): l is string => !!l);
      s.destroy();
      const m = data.manifest;
      setStatus({
        kind: "ok",
        lines: [
          `Datenpaket ${m.version}: ${m.counts.cards} Karten (${m.counts.cardsDe} mit deutschem Text), ${m.counts.scripts} Skripte`,
          `Kern ${(t1 - t0).toFixed(0)} ms · Combo ${(t2 - t1).toFixed(0)} ms`,
          "Abnahme-Combo: KOMPLETT ✔", "", ...log,
        ],
      });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="page">
      <header className="topbar plain">
        <button className="icon-btn" onClick={() => set({ route: { screen: "decks" } })} aria-label="Zurück">←</button>
        <h1>Systemcheck</h1>
      </header>
      <p className="muted">Prüft, ob Regelkern und Kartenskripte auf diesem Gerät laufen, indem die Abnahme-Combo automatisch gespielt wird.</p>
      <button className="btn primary" onClick={run} disabled={status.kind === "running"}>Systemcheck starten</button>
      {status.kind === "running" && <p>Läuft …</p>}
      {status.kind === "error" && <p className="error" role="alert">Fehler: {status.message}</p>}
      {status.kind === "ok" && <pre className="log" data-testid="selfcheck-result">{status.lines.join("\n")}</pre>}
    </div>
  );
}
