import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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
  plugins: [react(), serveBundle()],
});
