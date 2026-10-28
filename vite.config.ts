import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** Im Dev-Server das lokal gebaute Datenpaket (data/bundle) unter /data/ ausliefern. */
function serveBundle(): Plugin {
  const dir = path.resolve("data/bundle");
  return {
    name: "serve-data-bundle",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const file = path.join(dir, decodeURIComponent((req.url ?? "/").split("?")[0]));
        if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Relativ, damit die App unter https://<nutzer>.github.io/<repo>/ und in Capacitor funktioniert.
  base: "./",
  plugins: [
    react(),
    serveBundle(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Web-App-Manifest (Installation, Icons) folgt in Schritt 6.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm}"],
        // ocgcore-wasm 0.1.6: diese beiden Module enthalten nur das eingebettete WASM (je ~1,3 MB) und werden
        // nie geladen, weil src/web/core.ts das WASM selbst übergibt → nicht vorhalten. Bei Versionswechsel prüfen.
        globIgnores: ["**/ocgcore.sync-OBPMIIOW-*.js", "**/ocgcore.jspi-6EJJOY3Y-*.js"],
        // Datenpaket cached die App selbst (versioniert), nicht der Service Worker.
        navigateFallbackDenylist: [/\/data\//],
        runtimeCaching: [
          {
            // Kartenbilder: einmal von YGOPRODeck laden, danach nur noch lokal (kein wiederholtes Hotlinking).
            urlPattern: ({ url }) => url.origin === "https://images.ygoprodeck.com",
            handler: "CacheFirst",
            options: {
              cacheName: "card-images",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 4000 },
            },
          },
        ],
      },
    }),
  ],
});
