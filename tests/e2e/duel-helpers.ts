// Gemeinsame Schritte für Duell-Tests: Tippen, Zonenwahl, Auswahlfenster.
import { expect, test, type Page } from "@playwright/test";

export const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/${name}.png` });

export const prompt = (page: Page) => page.locator("section.prompt");

/** Warten, bis der Worker geantwortet hat. */
export async function settle(page: Page) {
  await expect(page.locator(".duel.busy")).toHaveCount(0);
}

/** Zonen- und Positionswahl (falls offen): erste leuchtende Zone bzw. offener Angriff. */
export async function place(page: Page) {
  for (let i = 0; i < 4; i++) {
    await settle(page);
    const zone = page.locator(".cell.can-place").first();
    if (await zone.count()) { await zone.tap(); continue; }
    const pos = prompt(page).getByRole("button", { name: "offener Angriff" });
    if (await pos.count()) { await pos.click(); continue; }
    return;
  }
}

/** Freiwillige Antwortfenster (z. B. Schnellzauber auf der Hand) ablehnen. */
export async function passChains(page: Page) {
  for (let i = 0; i < 5; i++) {
    await settle(page);
    const pass = prompt(page).getByRole("button", { name: "Nicht aktivieren" });
    if (!(await pass.count())) return;
    await pass.click();
  }
}

/** Karte auf der Hand oder dem Feld antippen und eine Aktion wählen. */
export async function act(page: Page, card: string, action: RegExp) {
  await place(page);
  await passChains(page);
  // Echtes Tippen (Touch), nicht Mausklick: deckt den „Geisterklick“ ins frisch geöffnete Menü ab.
  await page.getByRole("button", { name: new RegExp(`${esc(card)}( \\(|).*– Aktionen$`) }).first().tap();
  await page.getByRole("dialog").getByRole("button", { name: action }).tap();
  await settle(page);
}

/** Aktion über einen Stapel (Friedhof, Extra Deck …). */
export async function actFromPile(page: Page, pile: RegExp, action: RegExp) {
  await passChains(page);
  await page.getByRole("button", { name: pile }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: action }).click();
  await settle(page);
}

/** Optionalen Effekt aktivieren – als Ja/Nein oder als Kettenauswahl. */
export async function trigger(page: Page, card: string) {
  await place(page);
  await expect(prompt(page)).toBeVisible();
  const yes = prompt(page).getByRole("button", { name: "Ja", exact: true });
  if (await yes.count()) await yes.click();
  else await prompt(page).getByRole("button", { name: new RegExp(esc(card)) }).first().click();
  await settle(page);
}

/** Karten im Auswahlfenster wählen und bestätigen (Raster oder schrittweise Mehrfachauswahl). */
export async function pick(page: Page, ...cards: string[]) {
  await place(page);
  await expect(prompt(page)).toBeVisible();
  if (await prompt(page).locator(".select-grid").count()) {
    for (const c of cards) await prompt(page).locator(".select-item:not(.on)", { hasText: c }).first().click();
    await prompt(page).getByRole("button", { name: /^Bestätigen/ }).click();
    await settle(page);
  } else {
    for (const c of cards) {
      await prompt(page).getByRole("button", { name: new RegExp(`^Wählen: ${esc(c)}`) }).first().click();
      await settle(page);
    }
    const done = prompt(page).getByRole("button", { name: "Fertig" });
    if (await done.count()) { await done.click(); await settle(page); }
  }
}

export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
