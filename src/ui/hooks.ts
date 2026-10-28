// Kleine UI-Hilfen: Layout nach Ausrichtung, langes Drücken, Scrollposition merken.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from "react";
import { useApp } from "../app/store";

export type Layout = "portrait" | "landscape";

/** Querformat-Layout bei Querformat sowie auf Tablets/Desktop (ab 700 px Breite). */
const QUERY = "(orientation: landscape), (min-width: 700px)";

export function useLayout(): Layout {
  const get = (): Layout => (window.matchMedia(QUERY).matches ? "landscape" : "portrait");
  const [layout, setLayout] = useState<Layout>(get);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setLayout(get());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return layout;
}

/** Tippen und langes Drücken (450 ms) unterscheiden; Bewegung > 10 px bricht ab (Scrollen). */
export function usePress(onTap: () => void, onLong: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const longFired = useRef(false);
  const clear = () => { window.clearTimeout(timer.current); timer.current = undefined; };
  return {
    onPointerDown(e: RPointerEvent) {
      longFired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => { longFired.current = true; onLong(); }, 450);
    },
    onPointerMove(e: RPointerEvent) {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) { clear(); start.current = null; }
    },
    onPointerUp() {
      const wasPress = start.current && !longFired.current && timer.current !== undefined;
      clear();
      start.current = null;
      if (wasPress) onTap();
    },
    onPointerCancel() { clear(); start.current = null; },
    onContextMenu(e: Event | { preventDefault(): void }) { e.preventDefault(); },
  };
}

/** Scrollposition eines Containers im Store merken und wiederherstellen. */
export function useRememberScroll(key: string): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const setScroll = useApp((s) => s.setScroll);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = useApp.getState().scroll[key] ?? 0;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setScroll(key, el.scrollTop)); };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [key, setScroll]);
  return ref;
}
