// App-Rahmen: Datenpaket laden, Decks laden, Bildschirm nach Route anzeigen.
import { useEffect, useState } from "react";
import { useApp } from "./app/store";
import { CardSearch } from "./cards/search";
import { DuelScreen } from "./duel/DuelScreen";
import { DuelSetup } from "./duel/DuelSetup";
import { DeckEditor } from "./screens/DeckEditor";
import { DeckList } from "./screens/DeckList";
import { SystemCheck } from "./screens/SystemCheck";
import { loadBundleFromUrl } from "./web/bundle";
import { dataBaseUrl, installBackButton } from "./platform";
import { useOrientationLock } from "./app/settings";

export function App() {
  const { data, route, setData, loadDecks } = useApp();
  const [progress, setProgress] = useState("Starte …");
  const [error, setError] = useState<string | null>(null);
  useOrientationLock();
  useEffect(() => {
    installBackButton({
      closeDetail: () => useApp.getState().detail !== null && (useApp.getState().set({ detail: null }), true),
      inDuel: () => useApp.getState().route.screen === "duel",
      toStart: () => useApp.getState().route.screen !== "decks" && (useApp.getState().set({ route: { screen: "decks" } }), true),
    });
  }, []);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      try {
        const [bundle] = await Promise.all([
          loadBundleFromUrl(dataBaseUrl(), (s) => !cancelled && setProgress(`Lade ${s} …`)),
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

  return (
    <>
      {route.screen === "deck" ? <DeckEditor id={route.id} /> : route.screen === "system" ? <SystemCheck /> : route.screen === "duel" ? <DuelScreen /> : <DeckList />}
      <DuelSetup />
    </>
  );
}
