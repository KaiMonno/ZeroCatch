import { expect, test } from "@playwright/test";
import { dealCard } from "./helpers";

test.describe("deal feed", () => {
  test("shows the featured hero with a claim link", async ({ page }) => {
    await page.goto("/");
    const hero = dealCard(page, "E2E Hero Game");
    await expect(hero.getByText(/Featured · E2E Games Store/)).toBeVisible();
    await expect(hero.getByRole("link", { name: /Claim it free/ })).toHaveAttribute("href", "https://example.com/deal");
    await expect(hero.getByText("No Credit Card Required")).toBeVisible();
    await expect(hero.getByText("Account Required")).toBeVisible();
  });

  test("groups itch.io games into a folder that opens", async ({ page }) => {
    await page.goto("/");
    const folder = page.locator("details").filter({ hasText: "Free itch.io games" });
    await expect(folder).toBeVisible();
    const game = folder.getByRole("heading", { name: "E2E Itch Game 1" });
    await expect(game).toBeHidden();
    await folder.locator(":scope > summary").click();
    await expect(game).toBeVisible();
    // itch.io sorts after everything else: the folder comes after the regular cards.
    const pizzaTop = (await dealCard(page, "E2E Free Pizza Slice").boundingBox())!.y;
    expect((await folder.boundingBox())!.y).toBeGreaterThan(pizzaTop);
  });

  test("trials tab lists the longest trial first, with honest badges", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Deal categories" }).getByRole("link", { name: /Trials/ }).click();
    await expect(page).toHaveURL(/tab=trials/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Instant-Cancel Trials");

    const titles = await page.getByRole("heading", { level: 3 }).allTextContents();
    expect(titles.indexOf("E2E Long Trial")).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf("E2E Long Trial")).toBeLessThan(titles.indexOf("E2E Short Trial"));

    const long = dealCard(page, "E2E Long Trial");
    await expect(long.getByText("3 months")).toBeVisible();
    await expect(long.getByText("Card Required at Signup")).toBeVisible();
    await expect(long.getByText("Instant-Cancel Safe")).toBeVisible();
    // Freebies never appear on the trials tab.
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);
  });

  test("filter chips narrow the feed and live in the URL", async ({ page }) => {
    await page.goto("/");
    const filters = page.getByRole("list", { name: "Filters" });

    await filters.getByRole("link", { name: "No account" }).click();
    await expect(page).toHaveURL(/f=no-account/);
    await expect(filters.getByRole("link", { name: "No account" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Free Sample Box" })).toHaveCount(0);

    await filters.getByRole("link", { name: "Ending soon" }).click();
    await expect(page).toHaveURL(/f=no-account%2Cending-soon|f=no-account,ending-soon/);
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toBeVisible();

    await filters.getByRole("link", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/f=/);
    await expect(page.getByRole("heading", { name: "E2E Free Sample Box" })).toBeVisible();
  });

  test("a shared link restores the same view", async ({ page }) => {
    await page.goto("/?tab=trials&q=short");
    await expect(page.getByRole("searchbox", { name: "Search deals" })).toHaveValue("short");
    await expect(page.getByRole("heading", { name: "E2E Short Trial" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Long Trial" })).toHaveCount(0);
  });
});
