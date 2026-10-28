// Regelkern im Browser laden. Das WASM wird über Vite als eigene Datei ausgeliefert.
import createCore, { type OcgCoreSync } from "ocgcore-wasm";
import wasmUrl from "ocgcore-wasm/lib/ocgcore.sync.wasm?url";

export async function createBrowserCore(): Promise<OcgCoreSync> {
  const res = await fetch(wasmUrl);
  if (!res.ok) throw new Error(`Regelkern (WASM) nicht ladbar: HTTP ${res.status}`);
  return createCore({ sync: true, wasmBinary: await res.arrayBuffer() });
}
