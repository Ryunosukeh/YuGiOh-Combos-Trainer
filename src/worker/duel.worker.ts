// Duell-Worker: Regelkern + Sitzung laufen hier, damit die Oberfläche flüssig bleibt.
import type { OcgCoreSync } from "ocgcore-wasm";
import type { GameData } from "../engine/data";
import { DuelSession } from "../engine/session";
import { buildView } from "../engine/view";
import { createBrowserCore } from "../web/core";
import { loadBundleFromUrl } from "../web/bundle";
import type { FromWorker, ToWorker } from "./protocol";

let core: OcgCoreSync | null = null;
let data: GameData | null = null;
let session: DuelSession | null = null;

const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

function sendState(reset: boolean, from: number, t0: number) {
  const s = session!;
  post({
    type: "state",
    view: buildView(s),
    messages: reset ? s.history : s.history.slice(from),
    reset,
    responses: s.responses,
    ms: Math.round(performance.now() - t0),
  });
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  const t0 = performance.now();
  try {
    switch (msg.type) {
      case "start": {
        // Datenpaket kommt aus dem Cache Storage (hat die Oberfläche bereits geladen) → schnell.
        data ??= await loadBundleFromUrl(msg.base);
        core ??= await createBrowserCore();
        session?.destroy();
        session = DuelSession.start(core, data, msg.config, msg.responses ?? []);
        sendState(true, 0, t0);
        break;
      }
      case "respond": {
        if (!session) throw new Error("Kein Duell gestartet");
        const from = session.history.length;
        if (!session.respond(msg.response)) { post({ type: "rejected" }); break; }
        sendState(false, from, t0);
        break;
      }
      case "undo": {
        if (!session) throw new Error("Kein Duell gestartet");
        session = session.undo(msg.n);
        sendState(true, 0, t0);
        break;
      }
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
