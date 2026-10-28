// Deckbuilder-Oberfläche: Import der Abnahme-Liste, Suche, Kartenansicht, Drehen ohne Verlust.
// Läuft in beiden Projekten (hoch 360×800, quer 800×360) und legt Screenshots unter test-results/screens/ ab.
import { expect, test, type Page } from "@playwright/test";
import { ACCEPTANCE_LIST } from "../acceptance-list";
import { checkLayout } from "./layout";

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}/${name}.png` });

test.beforeEach(async ({ page }) => {
  // Keine Bilder von YGOPRODeck in Tests laden (schont deren Server, Screenshots bleiben stabil) → Platzhalter.
  await page.route("https://images.ygoprodeck.com/**", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Meine Decks" })).toBeVisible({ timeout: 30_000 });
});

test("Massen-Import der Abnahme-Liste (deutsch) → gültiges Deck", async ({ page }) => {
  await checkLayout(page);
  await shot(page, "01-start");
  await page.getByRole("button", { name: "Liste importieren" }).click();
  await page.getByRole("textbox", { name: "Deckliste" }).fill(ACCEPTANCE_LIST);
  await shot(page, "02-import-text");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByText("37 sicher")).toBeVisible();
  await expect(page.getByText("0 unsicher")).toBeVisible();
  await expect(page.getByText("0 nicht gefunden")).toBeVisible();
  await page.getByLabel("Name des neuen Decks").fill("Memento Abnahme");
  await shot(page, "03-import-vorschau");
  await checkLayout(page);
  await page.getByRole("button", { name: /Übernehmen \(42\/15\/0\)/ }).click();

  await expect(page.getByText(/Deck ist gültig/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Main Deck\s*42/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Extra Deck\s*15/ })).toBeVisible();
  await checkLayout(page);
  await shot(page, "04-deck");
});

test("Suche mit Tippfehler, Kartenansicht DE/EN, Karte hinzufügen", async ({ page }) => {
  await page.getByRole("button", { name: "Neues Deck" }).click();
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.getByLabel("Kartensuche").fill("Enghex");
  const row = page.getByRole("button", { name: "Mementotlanische Enghexe anzeigen" });
  await expect(row).toBeVisible();
  await shot(page, "05-suche");
  await checkLayout(page);

  await page.getByRole("button", { name: "Mementotlanische Enghexe hinzufügen" }).click();
  await page.getByRole("button", { name: "Mementotlanische Enghexe hinzufügen" }).click();
  await row.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("FINSTERNIS · Stufe 3 · [Hexer/Effekt]")).toBeVisible();
  await expect(dialog.getByText(/Falls diese Karte als Normal- oder Spezialbeschwörung/)).toBeVisible();
  await expect(dialog.locator(".count-row").first().locator(".count")).toHaveText("2");
  await shot(page, "06-karte-de");
  await checkLayout(page);
  await dialog.getByRole("button", { name: "EN", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Mementotlan Angwitch" })).toBeVisible();
  await expect(dialog.getByText(/If this card is Normal or Special Summoned/)).toBeVisible();
  await shot(page, "07-karte-en");
  await dialog.getByRole("button", { name: "Zu Main Deck hinzufügen" }).click();
  await expect(dialog.locator(".count-row").first().locator(".count")).toHaveText("3");
  await expect(dialog.getByRole("button", { name: "Zu Main Deck hinzufügen" })).toBeDisabled(); // max. 3
});

test("Unsichere Zeilen bieten Vorschläge zum Antippen", async ({ page }) => {
  await page.getByRole("button", { name: "Liste importieren" }).click();
  await page.getByRole("textbox", { name: "Deckliste" }).fill("3x Mementotlanische Enghex\n2 Ash Blosom\n1 Qwertzuiop Blablub");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByText("2 unsicher")).toBeVisible();
  await expect(page.getByText("1 nicht gefunden")).toBeVisible();
  const ash = page.getByRole("radiogroup", { name: "Vorschläge für Ash Blosom" });
  await expect(ash.getByRole("radio", { name: "Aschenblüte & Freudiger Frühling" })).toBeChecked();
  await shot(page, "08-import-unsicher");
  await checkLayout(page);
  await ash.getByRole("radio", { name: "auslassen" }).click();
  await expect(page.getByRole("button", { name: /Übernehmen \(3\/0\/0\)/ })).toBeVisible();
});

test("Drehen: offener Import-Dialog, Text und Suche bleiben erhalten", async ({ page }) => {
  const portrait = test.info().project.name.startsWith("hoch");
  const other = portrait ? { width: 800, height: 360 } : { width: 360, height: 800 };
  await page.getByRole("button", { name: "Neues Deck" }).click();
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.getByLabel("Kartensuche").fill("Tatsuno");
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByRole("textbox", { name: "Deckliste" }).fill("3x Mementotlanische Enghexe");
  await page.setViewportSize(other);
  await expect(page.getByRole("textbox", { name: "Deckliste" })).toHaveValue("3x Mementotlanische Enghexe");
  await shot(page, "09-gedreht-import");
  await checkLayout(page);
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByLabel("Kartensuche")).toHaveValue("Tatsuno");
  await expect(page.getByRole("button", { name: /Tatsunootoshigo anzeigen/ }).first()).toBeVisible();
  await shot(page, "10-gedreht-editor");
  await checkLayout(page);
});

test("Decks verwalten: umbenennen, kopieren, löschen", async ({ page }) => {
  await page.getByRole("button", { name: "Neues Deck" }).click();
  await page.getByLabel("Name").fill("Testdeck");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.getByRole("button", { name: "Zurück zur Deckliste" }).click();
  await page.getByRole("button", { name: "Aktionen für Testdeck" }).click();
  await page.getByRole("button", { name: "Kopieren" }).click();
  await expect(page.getByText("Testdeck (Kopie)")).toBeVisible();
  await page.getByRole("button", { name: "Aktionen für Testdeck (Kopie)" }).click();
  await page.getByRole("button", { name: "Umbenennen" }).click();
  await page.getByLabel("Name").fill("Zweitdeck");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Zweitdeck")).toBeVisible();
  await page.getByRole("button", { name: "Aktionen für Zweitdeck" }).click();
  await page.getByRole("button", { name: "Löschen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
  await expect(page.getByText("Zweitdeck")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Testdeck")).toBeVisible(); // in IndexedDB gespeichert
  await shot(page, "11-deckliste");
  await checkLayout(page);
});
