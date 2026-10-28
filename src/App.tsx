// App-Rahmen: Datenpaket laden, Decks laden, Bildschirm nach Route anzeigen.
import { useEffect, useState } from "react";
import { useApp } from "./app/store";
import { CardSearch } from "./cards/search";
import { DeckEditor } from "./screens/DeckEditor";
import { DeckList } from "./screens/DeckList";
import { SystemCheck } from "./screens/SystemCheck";
import { loadBundleFromUrl } from "./web/bundle";

export function App() {
  const { data, route, setData, loadDecks } = useApp();
  const [progress, setProgress] = useState("Starte …");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      try {
        const [bundle] = await Promise.all([
          loadBundleFromUrl(new URL("data/", document.baseURI).toString(), (s) => !cancelled && setProgress(`Lade ${s} …`)),
          loadDecks(),
        ]);
        if (cancelled) return;
        setProgress("Baue Suchindex …");
        await new Promise((r) => setTimeout(r, 0)); // Anzeige aktualisieren lassen
        setData(bundle, new CardSearch(bundle));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [data, setData, loadDecks]);

  if (error) return <div className="page"><h1>Fehler beim Laden</h1><p className="error" role="alert">{error}</p><button className="btn" onClick={() => location.reload()}>Erneut versuchen</button></div>;
  if (!data) return <div className="page loading"><h1>Yu-Gi-Oh! Combo-Trainer</h1><p>{progress}</p></div>;

  switch (route.screen) {
    case "deck": return <DeckEditor id={route.id} />;
    case "system": return <SystemCheck />;
    default: return <DeckList />;
  }
}
