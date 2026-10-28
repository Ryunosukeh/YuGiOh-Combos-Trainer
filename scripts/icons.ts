// Erzeugt alle App-Icons (PWA + Android) und Android-Startbilder aus einem eigenen SVG-Motiv.
// Aufruf: npm run icons (braucht das vorinstallierte Chromium von Playwright). Ergebnis wird committet.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BG1 = "#1d1240";
const BG2 = "#6b3fd4";

/** Motiv im 108er-Raster (Android Adaptive Icon); Inhalt bleibt in der sicheren Mitte (21…87). */
const glyph = `
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#d79a1e"/></linearGradient>
    <linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a2ff"/><stop offset="1" stop-color="#5b36b8"/></linearGradient>
  </defs>
  <g transform="rotate(-14 54 56)">
    <rect x="31" y="31" width="32" height="46" rx="4" fill="url(#back)" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>
  </g>
  <g transform="rotate(10 54 56)">
    <rect x="45" y="30" width="32" height="46" rx="4" fill="url(#gold)" stroke="#fff" stroke-width="1.8"/>
    <rect x="49" y="35" width="24" height="20" rx="2" fill="#2a1a5e" opacity=".85"/>
    <path d="M61 38 l3.2 6.3 6.3 3.2 -6.3 3.2 -3.2 6.3 -3.2 -6.3 -6.3 -3.2 6.3 -3.2z" fill="#fff6d6" transform="translate(0 -2.5) scale(1) "/>
    <rect x="49" y="59" width="24" height="2.6" rx="1.3" fill="#7a5410" opacity=".55"/>
    <rect x="49" y="64" width="17" height="2.6" rx="1.3" fill="#7a5410" opacity=".55"/>
  </g>`;

const svg = (size: number, opts: { bg: boolean; round?: boolean; pad?: number }) => {
  // pad: Zusatzrand (maskierbares PWA-Icon / Legacy-Icon), in 108er-Einheiten
  const p = opts.pad ?? 0;
  const vb = `${-p} ${-p} ${108 + 2 * p} ${108 + 2 * p}`;
  const bg = opts.bg
    ? `<defs><radialGradient id="bg" cx=".35" cy=".25" r="1"><stop offset="0" stop-color="${BG2}"/><stop offset="1" stop-color="${BG1}"/></radialGradient></defs>
       ${opts.round ? `<circle cx="54" cy="54" r="${54 + p}" fill="url(#bg)"/>` : `<rect x="${-p}" y="${-p}" width="${108 + 2 * p}" height="${108 + 2 * p}" fill="url(#bg)"/>`}`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}">${bg}${glyph}</svg>`;
};

const root = path.resolve(".");
const res = path.join(root, "android/app/src/main/res");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const render = async (file: string, w: number, h: number, html: string) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } }));
  };

  // Web/PWA. Normale Icons: Motiv etwas größer (wenig Rand, -12); maskierbar: volle Fläche mit Sicherheitsrand.
  writeFileSync(path.join(root, "public/icon.svg"), svg(512, { bg: true, pad: -12 }));
  for (const s of [192, 512]) await render(`public/icon-${s}.png`, s, s, svg(s, { bg: true, pad: -12 }));
  await render("public/icon-maskable-512.png", 512, 512, svg(512, { bg: true }));
  await render("public/apple-touch-icon.png", 180, 180, svg(180, { bg: true, pad: -8 }));

  // Android: Legacy-Icons (eckig/rund), Vordergrund für Adaptive Icons, Startbilder.
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
  for (const [d, f] of Object.entries(dens)) {
    const l = 48 * f, fg = 108 * f;
    await render(`${res}/mipmap-${d}/ic_launcher.png`, l, l, svg(l, { bg: true, pad: -12 }));
    await render(`${res}/mipmap-${d}/ic_launcher_round.png`, l, l, svg(l, { bg: true, round: true, pad: -12 }));
    await render(`${res}/mipmap-${d}/ic_launcher_foreground.png`, fg, fg, svg(fg, { bg: false }));
  }
  const splash = (w: number, h: number) => {
    const s = Math.round(Math.min(w, h) * 0.45);
    return `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;background:${BG1}">${svg(s, { bg: false, pad: -14 })}</div>`;
  };
  const sizes: Record<string, [number, number]> = {
    "drawable": [480, 320],
    "drawable-land-mdpi": [480, 320], "drawable-land-hdpi": [800, 480], "drawable-land-xhdpi": [1280, 720],
    "drawable-land-xxhdpi": [1600, 960], "drawable-land-xxxhdpi": [1920, 1280],
    "drawable-port-mdpi": [320, 480], "drawable-port-hdpi": [480, 800], "drawable-port-xhdpi": [720, 1280],
    "drawable-port-xxhdpi": [960, 1600], "drawable-port-xxxhdpi": [1280, 1920],
  };
  for (const [dir, [w, h]] of Object.entries(sizes)) await render(`${res}/${dir}/splash.png`, w, h, splash(w, h));
  writeFileSync(`${res}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG1}</color>\n</resources>\n`);
  await browser.close();
  console.log("Icons erzeugt.");
}

main();
