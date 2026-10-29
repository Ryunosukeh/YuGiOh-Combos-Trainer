import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { isNative, isTauri } from "./platform";
import "./styles.css";

// Service Worker (Offline, Bild-Cache) nur im Browser/PWA. Android-App und EXE bringen die Dateien selbst mit.
if (!isNative && !isTauri && "serviceWorker" in navigator) import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
