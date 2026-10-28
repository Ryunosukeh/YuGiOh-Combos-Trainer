import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { isNative } from "./platform";
import "./styles.css";

// Service Worker (Offline, Bild-Cache) nur im Browser/PWA. Die Android-App bringt die Dateien in der APK mit.
if (!isNative && "serviceWorker" in navigator) import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
