// Vorläufige Startseite (Schritt 2): Systemcheck, ob Datenpaket und Regelkern im Browser laufen.
// Die eigentliche Oberfläche (Deckbuilder, Duell) folgt in den Schritten 3 und 4.
import { useState } from "react";
import { Driver } from "./engine/driver";
import { DuelSession } from "./engine/session";
import { C, mementoDeck, playAcceptanceCombo } from "./fixtures/memento";
import { createBrowserCore } from "./web/core";
import { loadBundleFromUrl } from "./web/bundle";
import { describeMessage } from "./engine/describe";

type Status = { kind: "idle" } | { kind: "running"; step: string } | { kind: "ok"; lines: string[] } | { kind: "error"; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function run() {
    try {
      const t0 = performance.now();
      const data = await loadBundleFromUrl(new URL("data/", document.baseURI).toString(), (step) => setStatus({ kind: "running", step: `Lade ${step} …` }));
      const tData = performance.now();
      setStatus({ kind: "running", step: "Starte Regelkern …" });
      const core = await createBrowserCore();
      const tCore = performance.now();
      const s = DuelSession.start(core, data, { deck: mementoDeck, seed: 1234, goFirst: true, hand: [C.Angwitch] });
      playAcceptanceCombo(new Driver(s));
      const tCombo = performance.now();
      const log = s.history.map((m) => describeMessage(m, data, s.me)).filter((l): l is string => !!l);
      s.destroy();
      const m = data.manifest;
      setStatus({
        kind: "ok",
        lines: [
          `Datenpaket ${m.version}: ${m.counts.cards} Karten (${m.counts.cardsDe} mit deutschem Text), ${m.counts.scripts} Skripte`,
          `Laden ${(tData - t0).toFixed(0)} ms · Kern ${(tCore - tData).toFixed(0)} ms · Combo ${(tCombo - tCore).toFixed(0)} ms`,
          "Abnahme-Combo: KOMPLETT ✔",
          "",
          ...log,
        ],
      });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <main className="page">
      <h1>Yu-Gi-Oh! Combo-Trainer</h1>
      <p className="muted">Entwicklungsstand: Schritt 2 – Regelkern und Daten. Deckbuilder und Duell-Oberfläche folgen.</p>
      <button className="primary" onClick={run} disabled={status.kind === "running"}>
        Systemcheck starten
      </button>
      {status.kind === "running" && <p>{status.step}</p>}
      {status.kind === "error" && <p className="error" role="alert">Fehler: {status.message}</p>}
      {status.kind === "ok" && (
        <pre className="log" data-testid="selfcheck-result">{status.lines.join("\n")}</pre>
      )}
    </main>
  );
}
