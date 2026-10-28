// Oberflächentests in Hoch- und Querformat (Handygröße). Braucht das Datenpaket (npm run update-data).
import { defineConfig } from "@playwright/test";

const phone = { isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "de-DE" };

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/artifacts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173/", serviceWorkers: "block" },
  projects: [
    { name: "hoch-360x800", use: { ...phone, viewport: { width: 360, height: 800 } } },
    { name: "quer-800x360", use: { ...phone, viewport: { width: 800, height: 360 } } },
  ],
  webServer: {
    command: "npm run build:site && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
