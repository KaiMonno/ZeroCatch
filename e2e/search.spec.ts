import { expect, test } from "@playwright/test";

test.describe("search", () => {
  test("keeps everything typed while results load (regression: spaces were eaten)", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Search deals" });
    await box.click();
    // Pause long enough after "free " for the debounced search to fire mid-typing.
    for (const ch of "free pizza") {
      await page.keyboard.type(ch);
      await page.waitForTimeout(ch === " " ? 600 : 80);
    }
    await expect(page).toHaveURL(/q=free(\+|%20)pizza/);
    await expect(box).toHaveValue("free pizza");
    await expect(box).toBeFocused();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Free Sample Box" })).toHaveCount(0);
  });

  test("shows an empty state, and clearing brings everything back", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Search deals" });
    await box.fill("zzzz no such deal");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(box).toHaveValue("");
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toBeVisible();
  });

  test("back and forward update the search box", async ({ page }) => {
    await page.goto("/?q=pizza");
    const box = page.getByRole("searchbox", { name: "Search deals" });
    await page.getByRole("navigation", { name: "Deal categories" }).getByRole("link", { name: /Trials/ }).click();
    await expect(page).toHaveURL(/tab=trials/);
    await page.goto("/?q=sample");
    await expect(box).toHaveValue("sample");
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/q=pizza/);
    await expect(box).toHaveValue("pizza");
  });
});
