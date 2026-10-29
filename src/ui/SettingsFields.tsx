// Geräte-Einstellungen (Ausrichtung, Duell-Hintergrund, Seitenleiste) – auf der Startseite und im Duell-Menü.
import { DUEL_BACKGROUNDS, ORIENTATIONS, useSettings } from "../app/settings";
import { isNative, isTauri } from "../platform";

export function SettingsFields() {
  const { duelBg, sidebar, orientation, orientationOk, setSettings } = useSettings();
  return (
    <>
      {/* Am PC gibt es nichts zu drehen. */}
      {!isTauri && <div className="field">
        <span>Bildschirmausrichtung</span>
        <div className="segmented" role="radiogroup" aria-label="Bildschirmausrichtung">
          {ORIENTATIONS.map((o) => (
            <button key={o.id} role="radio" aria-checked={orientation === o.id} className={orientation === o.id ? "on" : ""} onClick={() => setSettings({ orientation: o.id })}>{o.name}</button>
          ))}
        </div>
        {!orientationOk && !isNative && (
          <p className="muted small" role="status">Dieser Browser erlaubt das Festlegen nur in der installierten App bzw. im Vollbild. Tipp: über das Browser-Menü „Zum Startbildschirm hinzufügen“ installieren – oder die Android-App nutzen.</p>
        )}
      </div>}
      <div className="field">
        <span>Duell-Hintergrund</span>
        <div className="bg-choices" role="radiogroup" aria-label="Hintergrund">
          {DUEL_BACKGROUNDS.map((b) => (
            <button key={b.id} role="radio" aria-checked={duelBg === b.id} className={`bg-choice ${duelBg === b.id ? "on" : ""}`} data-bg={b.id} onClick={() => setSettings({ duelBg: b.id })}>
              <span className="bg-swatch" aria-hidden="true" />{b.name}
            </button>
          ))}
        </div>
      </div>
      <button className="btn" onClick={() => setSettings({ sidebar: sidebar === "right" ? "left" : "right" })}>Seitenleiste im Querformat: {sidebar === "right" ? "rechts → links" : "links → rechts"}</button>
    </>
  );
}
