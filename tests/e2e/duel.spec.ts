// Abnahmetest über die Oberfläche: Deck per Massen-Import (deutsche Namen), Testhand Enghexe,
// die komplette Combo aus der Aufgabenstellung durch Antippen – im Hoch- und im Querformat.
import { expect, test } from "@playwright/test";
import { ACCEPTANCE_LIST } from "../acceptance-list";
import { checkLayout } from "./layout";
import { act, actFromPile, pick, place, passChains, prompt, settle, shot, trigger } from "./duel-helpers";

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

  // Combo-Protokoll: Hochformat über den Knopf, Querformat in der Seitenleiste
  if (test.info().project.name.startsWith("hoch")) await page.getByRole("button", { name: "Protokoll" }).click();
  const protocol = page.getByRole("region", { name: "Combo-Protokoll" });
  await expect(protocol).toContainText("NS Mementotlanische Enghexe");
  await expect(protocol).toContainText("Mementotlanische Enghexe: sucht Mementotlanischer Tatsunootoshigo");
  await expect(protocol).toContainText("Mementomictlan: setzt Mementotlanische Fusion");
  await expect(protocol).not.toContainText("Blauäugiger");
  await protocol.getByRole("button", { name: "Kopieren" }).click();
  await expect(protocol.getByRole("button", { name: /Kopiert|manuell kopieren/ })).toBeVisible();
  await shot(page, "30-protokoll");
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

  // Einzelschritt zurück: Suche erneut offen, Tatsu nicht mehr auf der Hand
  await page.getByRole("button", { name: "Einzelschritt rückgängig" }).click();
  await settle(page);
  await expect(prompt(page)).toContainText("Mementotlanischer Tatsunootoshigo");
  await expect(page.getByRole("button", { name: /Mementotlanischer Tatsunootoshigo – Aktionen/ })).toHaveCount(0);

  // Ganze Aktion zurück (aus dem offenen Auswahlfenster heraus): Enghexe wieder auf der Hand, Feld leer
  await prompt(page).getByRole("button", { name: "Aktion abbrechen und rückgängig" }).click();
  await settle(page);
  await expect(page.getByRole("button", { name: /^Mementotlanische Enghexe – Aktionen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Monsterzone \d: Mementotlanische Enghexe/ })).toHaveCount(0);
});

test("Touch: Normalbeschwörung offen in Angriff, Feldzauber offen aktiviert (kein Geisterklick)", async ({ page }) => {
  await page.getByRole("button", { name: /Mementotlanische Enghexe – Aktionen/ }).tap();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Normalbeschwörung" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Normalbeschwörung" }).tap();
  await place(page);
  const card = page.getByRole("button", { name: /^Monsterzone \d: Mementotlanische Enghexe/ }).locator(".duel-card");
  await expect(card).not.toHaveClass(/facedown/);
  await expect(card).not.toHaveClass(/\bdef\b/);
});

test("Hintergrund wählen (bleibt nach Neuladen)", async ({ page }) => {
  await page.getByRole("button", { name: "Duell-Menü" }).click();
  await page.getByRole("radio", { name: "Arkana" }).click();
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.locator(".duel")).toHaveAttribute("data-bg", "arkana");
  await shot(page, "31-hintergrund-arkana");
  await checkLayout(page);
  await page.reload();
  await expect(page.locator(".duel")).toHaveAttribute("data-bg", "arkana", { timeout: 30_000 });
});
