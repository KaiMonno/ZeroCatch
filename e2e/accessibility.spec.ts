import { expect, test, type Locator, type Page } from "@playwright/test";
import { dealCard, expectNoA11yViolations, signIn, uniqueEmail } from "./helpers";

const PAGES = [
  ["home feed", "/"],
  ["trials tab", "/?tab=trials"],
  ["filtered, empty search", "/?q=zzzz-nothing&f=no-card"],
  ["what qualifies", "/what-qualifies"],
  ["sign in", "/login?error=cancelled"],
  ["unsubscribe", "/unsubscribe?token=x"],
] as const;

for (const viewport of [null, { width: 1280, height: 900 }]) {
  const size = viewport ? "desktop" : "phone";
  test.describe(`accessibility (${size})`, () => {
    if (viewport) test.use({ viewport, isMobile: false, hasTouch: false });

    for (const [name, path] of PAGES) {
      test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(path);
        await expectNoA11yViolations(page, `${name} (${size})`);
      });
    }

    test("open folder, report form and hide confirm have no violations", async ({ page }) => {
      await page.goto("/");
      await page.locator("summary", { hasText: "Free itch.io games" }).click();
      const pizza = dealCard(page, "E2E Free Pizza Slice");
      await pizza.getByText("Report a problem").click();
      await dealCard(page, "E2E Free Sample Box").getByRole("button", { name: "Hide E2E Samples" }).click();
      await expectNoA11yViolations(page, `interactive states (${size})`);
    });
  });
}

test("account page has no violations", async ({ page }) => {
  await signIn(page, uniqueEmail("a11y"));
  await expectNoA11yViolations(page, "account");
});

/** Presses Tab until `target` has focus; returns the labels of every stop on the way. */
async function tabTo(page: Page, target: Locator, maxStops = 80): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return stops;
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (el?.getAttribute("aria-label") || el?.textContent || "").trim().slice(0, 30);
      }),
    );
  }
  throw new Error(`never reached the target by Tab. Stops: ${stops.join(" → ")}`);
}

test("the feed works from the keyboard alone", async ({ page }) => {
  await page.goto("/");
  // The category tabs come before the search box.
  const stops = await tabTo(page, page.getByRole("searchbox", { name: "Search deals" }));
  expect(stops.some((s) => /Trials/.test(s)), stops.join(" → ")).toBe(true);
  await page.keyboard.type("pizza");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=pizza/);

  // The itch.io folder opens with Enter.
  await page.goto("/");
  await tabTo(page, page.locator("summary", { hasText: "Free itch.io games" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "E2E Itch Game 1" })).toBeVisible();

  // Every footer link is reachable.
  await tabTo(page, page.getByRole("link", { name: "Open source" }), 300);
});
