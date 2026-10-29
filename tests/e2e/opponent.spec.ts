// Gegner-Antworten: Handtrap für den Gegner festlegen und selbst für ihn entscheiden (Hoch- und Querformat).
import { expect, test } from "@playwright/test";
import { ACCEPTANCE_LIST } from "../acceptance-list";
import { checkLayout } from "./layout";
import { act, place, prompt, settle, shot, trigger } from "./duel-helpers";

test("Ash Blossom des Gegners: du entscheidest, Suche wird annulliert", async ({ page }) => {
  test.setTimeout(120_000);
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

  // Erste Schnellwahl = Ash Blossom. Erste Handtrap schaltet „Ich antworte für den Gegner“ ein.
  const chip = page.getByRole("button", { name: /zur Gegnerhand$/ }).first();
  const ash = (await chip.getAttribute("aria-label"))!.replace(/ zur Gegnerhand$/, "");
  await chip.click();
  await expect(page.getByRole("radio", { name: "Ich antworte für den Gegner" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: `${ash} aus der Gegnerhand entfernen` })).toBeVisible();
  await page.getByRole("button", { name: `${ash} aus der Gegnerhand entfernen` }).scrollIntoViewIfNeeded();
  await checkLayout(page);
  await shot(page, "40-gegnerhand-wahl");
  await page.getByRole("button", { name: "Duell starten" }).click();
  await expect(page.getByRole("button", { name: /Mementotlanische Enghexe – Aktionen/ })).toBeVisible({ timeout: 30_000 });

  // Gegnerhand ist einsehbar (5 Karten: Ash + 4 aus seinem Deck)
  await page.getByRole("button", { name: /^Gegnerhand ansehen \(5 Karten\)$/ }).tap();
  await expect(page.getByRole("dialog").getByRole("button", { name: ash })).toBeVisible();
  await shot(page, "41-gegnerhand");
  await page.getByRole("button", { name: "Schließen" }).click();

  // NS Enghexe → Suche aktivieren → der Gegner darf antworten
  await act(page, "Mementotlanische Enghexe", /^Normalbeschwörung$/);
  await place(page);
  await trigger(page, "Mementotlanische Enghexe");
  await expect(prompt(page)).toHaveClass(/for-opp/);
  await expect(prompt(page).getByText(/Du entscheidest für den Gegner/)).toBeVisible();
  await checkLayout(page);
  await shot(page, "42-gegner-antwort");
  await prompt(page).getByRole("button", { name: new RegExp(ash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  await settle(page);

  // Ash liegt im Friedhof des Gegners, keine Suche: kein Tatsunootoshigo auf der Hand, wieder Main Phase.
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Tatsunootoshigo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Gegnerhand ansehen \(4 Karten\)$/ })).toBeVisible();
  await shot(page, "43-nach-ash");
});
