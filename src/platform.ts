// Unterschiede zwischen Browser/PWA, Android-App (Capacitor) und Desktop-App (Tauri).
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { db } from "./app/db";

export const isNative = Capacitor.isNativePlatform();
/** Desktop-App (Tauri, Windows-EXE): reine Hülle um die Web-App, ohne eigene Tauri-Befehle. */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Veröffentlichte Web-App; Android- und Desktop-App laden das Datenpaket von dort (GitHub Pages erlaubt CORS). */
export const PAGES_URL = "https://ryunosukeh.github.io/YuGiOh-Combos-Trainer/";

export function dataBaseUrl(): string {
  return new URL("data/", isNative || isTauri ? PAGES_URL : document.baseURI).toString();
}

// ---------- Bildschirmausrichtung ----------
export type OrientationSetting = "auto" | "portrait" | "landscape";

/**
 * Ausrichtung sperren oder freigeben. App: zuverlässig über das Capacitor-Plugin.
 * Browser: Screen Orientation API – klappt meist nur im Vollbild bzw. als installierte App.
 * Rückgabe: false, wenn die Sperre nicht möglich war.
 */
export async function applyOrientation(o: OrientationSetting): Promise<boolean> {
  try {
    if (isNative) {
      if (o === "auto") await ScreenOrientation.unlock();
      else await ScreenOrientation.lock({ orientation: o });
      return true;
    }
    const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (o === "auto") { so.unlock?.(); return true; }
    if (!so.lock) return false;
    await so.lock(o);
    return true;
  } catch {
    return false;
  }
}

// ---------- Kartenbilder in der App: einmal herunterladen, dann aus IndexedDB ----------
const objectUrls = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
let active = 0;
const queue: (() => void)[] = [];
const MAX_PARALLEL = 4; // schont YGOPRODeck (Rate-Limit)

function slot<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active++;
      fn().then(resolve, reject).finally(() => { active--; queue.shift()?.(); });
    };
    if (active < MAX_PARALLEL) run();
    else queue.push(run);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Lokale URL eines Kartenbildes (App). Lädt beim ersten Mal nativ herunter (kein CORS) und speichert es. */
export function nativeImage(url: string): Promise<string | null> {
  const known = objectUrls.get(url);
  if (known) return Promise.resolve(known);
  let p = inFlight.get(url);
  if (!p) {
    p = (async () => {
      const stored = await db.images.get(url);
      let blob = stored?.blob;
      if (!blob) {
        const res = await slot(() => CapacitorHttp.get({ url, responseType: "blob" }));
        if (res.status !== 200 || typeof res.data !== "string") return null;
        blob = base64ToBlob(res.data, "image/jpeg");
        await db.images.put({ url, blob });
      }
      const obj = URL.createObjectURL(blob);
      objectUrls.set(url, obj);
      return obj;
    })().catch(() => null).finally(() => inFlight.delete(url));
    inFlight.set(url, p);
  }
  return p;
}

// ---------- Zurück-Taste (Android) ----------
/**
 * Die App nutzt keine Browser-Historie, deshalb würde die Zurück-Taste sofort die App schließen.
 * Reihenfolge: offenes Fenster schließen (wie Escape) → Kartenansicht schließen → im Duell nachfragen
 * → zur Deckliste → App beenden.
 */
export async function installBackButton(handlers: { closeDetail(): boolean; inDuel(): boolean; toStart(): boolean }) {
  if (!isNative) return;
  const { App } = await import("@capacitor/app");
  App.addListener("backButton", () => {
    if (document.querySelector('[role="dialog"]')) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return;
    }
    if (handlers.closeDetail()) return;
    if (handlers.inDuel()) { window.dispatchEvent(new Event("duel-back")); return; }
    if (handlers.toStart()) return;
    App.exitApp();
  });
}
