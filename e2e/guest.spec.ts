import { expect, test } from "@playwright/test";
import { dealCard, openCardMenu } from "./helpers";

test.describe("guest visitor", () => {
  test("marks a deal claimed, reveals it again, and undoes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Mark claimed\W+E2E Free Pizza Slice$/ }).click();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);

    await page.reload(); // stored in a cookie, so it survives a reload
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);

    await page.getByRole("link", { name: "Show 1 claimed" }).click();
    const card = dealCard(page, "E2E Free Pizza Slice");
    await card.getByRole("button", { name: /^Claimed\W+E2E Free Pizza Slice\. Undo$/ }).click();
    await expect(card.getByRole("button", { name: /^Mark claimed\W+E2E Free Pizza Slice$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /claimed$/ })).toHaveCount(0);
  });

  test("hides a vendor after confirming, and the chip brings it back", async ({ page }) => {
    await page.goto("/");
    const card = await openCardMenu(page, "E2E Free Pizza Slice");

    await card.getByRole("button", { name: "Hide E2E Pizza Co" }).click();
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Hide E2E Pizza Co" }).click();
    await expect(card.getByText("Hide all E2E Pizza Co deals?")).toBeVisible();
    await card.getByRole("button", { name: "Hide", exact: true }).click();

    const chip = page.getByRole("button", { name: "Show E2E Pizza Co deals again" });
    await expect(chip).toBeVisible();
    await expect(page.getByText(/Hiding 1 deal from/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);

    await page.reload();
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toBeVisible();
    await expect(chip).toHaveCount(0);
  });
});
