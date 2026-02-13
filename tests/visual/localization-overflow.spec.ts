import { expect, test, type Page } from "@playwright/test";

type RouteCase = {
  name: string;
  path: string;
};

const coreRoutes: RouteCase[] = [
  { name: "login", path: "/login" },
  { name: "dashboard", path: "/home" },
  { name: "deals", path: "/deals" },
  { name: "value-canvas", path: "/canvas" },
];

const locales = ["es", "en-XA"];

async function applyPseudoLocale(page: Page) {
  await page.addInitScript(() => {
    const map: Record<string, string> = {
      a: "à",
      A: "À",
      e: "ë",
      E: "Ë",
      i: "ï",
      I: "Ï",
      o: "ô",
      O: "Ô",
      u: "ü",
      U: "Ü",
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.textContent?.trim()) {
        textNodes.push(node);
      }
    }

    textNodes.forEach((node) => {
      const original = node.textContent ?? "";
      const accented = original.replace(/[aAeEiIoOuU]/g, (char) => map[char] ?? char);
      node.textContent = `[!! ${accented} !!]~~~~`;
    });
  });
}

async function assertNoMajorOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const ignored = new Set(["HTML", "BODY"]);
    const candidates = Array.from(document.querySelectorAll("*"));

    return candidates
      .filter((el) => !ignored.has(el.tagName))
      .map((el) => {
        const hasHorizontalOverflow = el.scrollWidth > el.clientWidth + 2;
        const hasVerticalOverflow = el.scrollHeight > el.clientHeight + 2;
        return {
          tag: el.tagName,
          testId: el.getAttribute("data-testid"),
          className: el.className,
          hasHorizontalOverflow,
          hasVerticalOverflow,
        };
      })
      .filter((el) => el.hasHorizontalOverflow || el.hasVerticalOverflow)
      .slice(0, 10);
  });

  expect(overflow, `Overflowing nodes detected: ${JSON.stringify(overflow, null, 2)}`).toEqual([]);
}

test.describe("Localization visual overflow checks", () => {
  for (const locale of locales) {
    for (const routeCase of coreRoutes) {
      test(`${routeCase.name} renders without overflow (${locale})`, async ({ page }) => {
        if (locale === "en-XA") {
          await applyPseudoLocale(page);
        }

        await page.goto(routeCase.path);
        await page.waitForLoadState("networkidle");

        await page.evaluate((loc) => {
          document.documentElement.lang = loc;
        }, locale);

        await assertNoMajorOverflow(page);

        await expect(page).toHaveScreenshot(`l10n-${routeCase.name}-${locale}.png`, {
          fullPage: true,
          animations: "disabled",
        });
      });
    }
  }
});
