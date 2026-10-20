import { expect, test, type Page } from "@playwright/test";
import { dealCard } from "./helpers";

/** Waits until the service worker controls the page and has saved both tabs and the offline page. */
async function offlineReady(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const saved = await Promise.all(["/", "/?tab=trials", "/offline"].map((u) => caches.match(u, { ignoreVary: true })));
        return saved.every(Boolean);
      }),
    )
    .toBe(true);
}

const banner = (page: Page) => page.getByRole("status").filter({ hasText: "You're offline" });

test.describe("offline (installed app)", () => {
  test("opens offline with the saved deals and both tabs", async ({ page, context }) => {
    await page.goto("/");
    await offlineReady(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "E2E Hero Game" })).toBeVisible();
    await expect(banner(page)).toContainText(/showing deals saved/);

    // Never opened, but saved when the app was installed.
    await page.getByRole("navigation", { name: "Deal categories" }).getByRole("link", { name: /Trials/ }).click();
    await expect(page.getByRole("heading", { name: "E2E Long Trial" })).toBeVisible();

    // A view that was never saved says so, with a way back.
    await page.goto("/?f=no-card&q=nothing-saved");
    await expect(page.getByRole("heading", { name: "This view isn't saved offline" })).toBeVisible();
    await page.getByRole("link", { name: "Pure Freebies" }).click();
    await expect(page.getByRole("heading", { name: "E2E Hero Game" })).toBeVisible();

    await context.setOffline(false);
    await expect(banner(page)).toHaveCount(0);
  });

  test("a claim made offline goes through when the connection is back", async ({ page, context }) => {
    await page.goto("/");
    await offlineReady(page);
    await context.setOffline(true);
    await expect(banner(page)).toBeVisible();

    const pizza = dealCard(page, "E2E Free Pizza Slice");
    await pizza.getByRole("button", { name: /^Mark claimed\W+E2E Free Pizza Slice$/ }).click();
    await expect(pizza.getByRole("button", { name: /Saving/ })).toBeVisible(); // waiting, not failed

    await context.setOffline(false);
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);
  });

  test("countdowns on a saved page reflect the real time", async ({ page, context }) => {
    await page.goto("/");
    await offlineReady(page);
    // Open the saved page a day later: the 20-hour pizza deal has ended.
    await page.clock.install({ time: Date.now() + 24 * 3_600_000 });
    await context.setOffline(true);
    await page.reload();
    await expect(dealCard(page, "E2E Free Pizza Slice").getByText("Expired")).toBeVisible();
    await expect(dealCard(page, "E2E Hero Game").getByText(/Ends in|Expires in/)).toBeVisible();
  });

  test("account pages are never saved", async ({ page, context }) => {
    await page.goto("/");
    await offlineReady(page);
    await context.setOffline(true);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "This view isn't saved offline" })).toBeVisible();
    expect(await page.evaluate(async () => Boolean(await caches.match("/login", { ignoreVary: true })))).toBe(false);
  });
});
