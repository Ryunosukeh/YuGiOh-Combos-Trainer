import type { CapacitorConfig } from "@capacitor/cli";

// Android-App (Capacitor): die gebaute Web-App aus dist/ als native Hülle.
const config: CapacitorConfig = {
  appId: "io.github.ryunosukeh.combotrainer",
  appName: "Combo-Trainer",
  webDir: "dist",
  android: {
    // Kartenbilder kommen per HTTPS von YGOPRODeck, Daten von GitHub Pages
    allowMixedContent: false,
  },
};

export default config;
