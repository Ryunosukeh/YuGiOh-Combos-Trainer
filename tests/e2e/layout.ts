import { expect, type Page } from "@playwright/test";

/** Keine waagerechte Scrollleiste und alle sichtbaren Bedienelemente mindestens 44 px hoch. */
export async function checkLayout(page: Page) {
  const r = await page.evaluate(() => {
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("button, input, textarea, summary, [role=tab]")) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || getComputedStyle(el).visibility === "hidden") continue;
      if (el.closest("[data-active=false]") || (el as HTMLInputElement).type === "file") continue;
      if (b.height < 44) small.push(`${el.tagName} „${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}“ ${Math.round(b.height)}px`);
    }
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, small };
  });
  expect(r.overflow, "waagerechtes Scrollen").toBeLessThanOrEqual(0);
  expect(r.small, "Tippflächen unter 44 px").toEqual([]);
}
