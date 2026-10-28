// Abnahmetest über die Oberfläche: Deck per Massen-Import (deutsche Namen), Testhand Enghexe,
// die komplette Combo aus der Aufgabenstellung durch Antippen – im Hoch- und im Querformat.
import { expect, test, type Page } from "@playwright/test";
import { ACCEPTANCE_LIST } from "../acceptance-list";
import { checkLayout } from "./layout";

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/${name}.png` });

const prompt = (page: Page) => page.locator("section.prompt");

/** Warten, bis der Worker geantwortet hat. */
async function settle(page: Page) {
  await expect(page.locator(".duel.busy")).toHaveCount(0);
}

/** Zonen- und Positionswahl (falls offen): erste leuchtende Zone bzw. offener Angriff. */
async function place(page: Page) {
  for (let i = 0; i < 4; i++) {
    await settle(page);
    const zone = page.locator(".cell.can-place").first();
    if (await zone.count()) { await zone.click(); continue; }
    const pos = prompt(page).getByRole("button", { name: "offener Angriff" });
    if (await pos.count()) { await pos.click(); continue; }
    return;
  }
}

/** Freiwillige Antwortfenster (z. B. Schnellzauber auf der Hand) ablehnen. */
async function passChains(page: Page) {
  for (let i = 0; i < 5; i++) {
    await settle(page);
    const pass = prompt(page).getByRole("button", { name: "Nicht aktivieren" });
    if (!(await pass.count())) return;
    await pass.click();
  }
}

/** Karte auf der Hand oder dem Feld antippen und eine Aktion wählen. */
async function act(page: Page, card: string, action: RegExp) {
  await place(page);
  await passChains(page);
  await page.getByRole("button", { name: new RegExp(`${esc(card)}( \\(|).*– Aktionen$`) }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: action }).click();
  await settle(page);
}

/** Aktion über einen Stapel (Friedhof, Extra Deck …). */
async function actFromPile(page: Page, pile: RegExp, action: RegExp) {
  await passChains(page);
  await page.getByRole("button", { name: pile }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: action }).click();
  await settle(page);
}

/** Optionalen Effekt aktivieren – als Ja/Nein oder als Kettenauswahl. */
async function trigger(page: Page, card: string) {
  await place(page);
  await expect(prompt(page)).toBeVisible();
  const yes = prompt(page).getByRole("button", { name: "Ja", exact: true });
  if (await yes.count()) await yes.click();
  else await prompt(page).getByRole("button", { name: new RegExp(esc(card)) }).first().click();
  await settle(page);
}

/** Karten im Auswahlfenster wählen und bestätigen (Raster oder schrittweise Mehrfachauswahl). */
async function pick(page: Page, ...cards: string[]) {
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

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.beforeEach(async ({ page }) => {
  await page.route("https://images.ygoprodeck.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Meine Decks" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Liste importieren" }).click();
  await page.getByRole("textbox", { name: "Deckliste" }).fill(ACCEPTANCE_LIST);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await page.getByLabel("Name des neuen Decks").fill("Memento");
  await page.getByRole("button", { name: /Übernehmen \(42\/15\/0\)/ }).click();
  await page.getByRole("button", { name: "Duell", exact: true }).click();
  await page.getByRole("radio", { name: "Testhand" }).click();
  await page.getByRole("button", { name: /^Mementotlanische Enghexe \(0\/3\)$/ }).click();
  await page.getByLabel(/Seed/).fill("1234");
  await shot(page, "20-duell-start");
  await page.getByRole("button", { name: "Duell starten" }).click();
  await expect(page.getByRole("button", { name: /Mementotlanische Enghexe – Aktionen/ })).toBeVisible({ timeout: 30_000 });
});

test("Abnahme-Combo komplett über die Oberfläche", async ({ page }) => {
  test.setTimeout(180_000);
  await shot(page, "21-feld-start");
  await checkLayout(page);

  // 1. NS Enghexe → sucht Tatsunootoshigo
  await act(page, "Mementotlanische Enghexe", /^Normalbeschwörung$/);
  await place(page);
  await shot(page, "22-trigger");
  await trigger(page, "Mementotlanische Enghexe");
  await shot(page, "23-suche");
  await pick(page, "Mementotlanischer Tatsunootoshigo");
  // 2. Tatsunootoshigo von der Hand beschwören
  await act(page, "Mementotlanischer Tatsunootoshigo", /Effekt 1/);
  await place(page);
  // 3. Tatsu: sich zerstören → Dachbodengeist + Goblin + Stab in den Friedhof
  await act(page, "Mementotlanischer Tatsunootoshigo", /Effekt 2/);
  await pick(page, "Mementotlanischer Tatsunootoshigo");
  await pick(page, "Mementotlanischer Dachbodengeist", "Mementotlanischer Goblin", "Mementotlanischer Stab");
  // 4. Dachbodengeist beschwört sich selbst → holt Tatsunootoshigo zurück
  await trigger(page, "Mementotlanischer Dachbodengeist");
  await place(page);
  await trigger(page, "Mementotlanischer Dachbodengeist");
  await pick(page, "Mementotlanischer Tatsunootoshigo");
  await shot(page, "24-nach-schritt-4");
  // 5. Enghexe ②: sich zerstören → Stab aus dem Friedhof beschwören
  await act(page, "Mementotlanische Enghexe", /Effekt 2/);
  await pick(page, "Mementotlanischer Stab");
  await pick(page, "Mementotlanische Enghexe");
  await place(page);
  // 6. Stab: Dachbodengeist zerstören → sucht Mementotlanische Fusion
  await act(page, "Mementotlanischer Stab", /Effekt 2/);
  await pick(page, "Mementotlanischer Dachbodengeist");
  await pick(page, "Mementotlanische Fusion");
  // 7. Fusion: Schöpfungskönig aus Enghexe (Friedhof), Tatsunootoshigo (Hand), Stab (Feld)
  await act(page, "Mementotlanische Fusion", /Aktivieren/);
  await place(page);
  await pick(page, "Mementomictlan Tecuhtlica - Schöpfungskönig");
  await shot(page, "25-fusionsmaterial");
  await checkLayout(page);
  await pick(page, "Mementotlanische Enghexe (Friedhof", "Mementotlanischer Tatsunootoshigo (Hand", "Mementotlanischer Stab (Monsterzone");
  await place(page);
  // 8. Schöpfungskönig legt Schöpfungskönig, Kombinierte Schöpfung, Akihiron in den Friedhof
  await trigger(page, "Mementomictlan Tecuhtlica - Schöpfungskönig");
  await pick(page, "Mementomictlan Tecuhtlica - Schöpfungskönig", "Mementoal Tecuhtlica - Kombinierte Schöpfung", "Mementotlanischer Akihiron");
  // 9. Schöpfungskönig aus dem Friedhof verbannen → Mementomictlan suchen und aktivieren
  await actFromPile(page, /^Friedhof: \d+ Karten? – Aktionen$/, /Schöpfungskönig – Effekt 1/);
  await pick(page, "Mementomictlan");
  await act(page, "Mementomictlan", /Aktivieren/);
  await place(page);
  // 10. Kombinierte Schöpfung aus dem Friedhof beschwören
  await actFromPile(page, /^Friedhof: \d+ Karten? – Aktionen$/, /Spezialbeschwörung: Mementoal Tecuhtlica/);
  await pick(page, "Mementotlanischer Goblin", "Mementotlanischer Dachbodengeist", "Mementotlanischer Tatsunootoshigo", "Mementotlanischer Stab", "Mementotlanischer Akihiron");
  await place(page);
  await shot(page, "26-vor-end-phase");
  // 11. End Phase: Mictlan setzt Mementotlanische Fusion
  await passChains(page);
  await page.getByRole("button", { name: "End Phase", exact: true }).click();
  await settle(page);
  await trigger(page, "Mementomictlan");
  await pick(page, "Mementotlanische Fusion");
  await place(page);

  // Endzustand
  await expect(page.getByRole("button", { name: /^Extra Monster Zone: Mementomictlan Tecuhtlica - Schöpfungskönig/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Monsterzone \d: Mementoal Tecuhtlica - Kombinierte Schöpfung/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Feldzone: Mementomictlan/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Zauber-\/Fallenzone \d: Mementotlanische Fusion/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Verbannt: 1 Karte$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Friedhof: 0 Karten/ })).toBeVisible();
  await passChains(page);
  await shot(page, "27-endzustand");
  await checkLayout(page);
});

test("Rückgängig, Feld ansehen und Drehen während einer Auswahl", async ({ page }) => {
  const portrait = test.info().project.name.startsWith("hoch");
  await act(page, "Mementotlanische Enghexe", /^Normalbeschwörung$/);
  await place(page);
  await trigger(page, "Mementotlanische Enghexe");
  await expect(prompt(page)).toContainText("Mementotlanischer Tatsunootoshigo");

  // Auswahlfenster einklappen und wieder öffnen
  await prompt(page).getByRole("button", { name: "Feld ansehen" }).click();
  await expect(prompt(page)).toHaveCount(0);
  await shot(page, "28-feld-ansehen");
  await page.getByRole("button", { name: /Auswahl öffnen/ }).click();
  await expect(prompt(page)).toBeVisible();

  // Drehen mit offener Auswahl
  await prompt(page).locator(".select-item", { hasText: "Mementotlanischer Tatsunootoshigo" }).first().click();
  await page.setViewportSize(portrait ? { width: 800, height: 360 } : { width: 360, height: 800 });
  await expect(prompt(page).locator(".select-item.on")).toContainText("Mementotlanischer Tatsunootoshigo");
  await shot(page, "29-gedreht-auswahl");
  await prompt(page).getByRole("button", { name: /^Bestätigen/ }).click();
  await settle(page);
  await expect(page.getByRole("button", { name: /Mementotlanischer Tatsunootoshigo – Aktionen/ })).toBeVisible();

  // Rückgängig: Suche erneut offen, Tatsu nicht mehr auf der Hand
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await settle(page);
  await expect(prompt(page)).toContainText("Mementotlanischer Tatsunootoshigo");
  await expect(page.getByRole("button", { name: /Mementotlanischer Tatsunootoshigo – Aktionen/ })).toHaveCount(0);
});
