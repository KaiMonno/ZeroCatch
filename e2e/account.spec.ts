import { expect, test } from "@playwright/test";
import { admin, dealCard, signIn, uniqueEmail, userIdFor } from "./helpers";

test.describe("signed-in visitor", () => {
  test("guest claims and hidden vendors move into the account on sign-in", async ({ context, page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Mark claimed\W+E2E Free Pizza Slice$/ }).click();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);
    await dealCard(page, "E2E Free Sample Box").getByRole("button", { name: "Hide E2E Samples" }).click();
    await page.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(page.getByRole("button", { name: "Show E2E Samples deals again" })).toBeVisible();

    const email = uniqueEmail("merge");
    await signIn(context, page, email);

    await expect(page.getByRole("heading", { name: /Hidden vendors/ })).toContainText("1");
    await expect(page.getByRole("button", { name: "Show E2E Samples deals again" })).toBeVisible();
    const claimed = page.getByRole("region", { name: /Claimed deals/ });
    await expect(claimed.getByText("E2E Free Pizza Slice", { exact: true })).toBeVisible();
    // The guest cookies are cleared once merged.
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("zc_claims");
    expect(names).not.toContain("zc_hidden_vendors");

    // Saved to the account, not the browser.
    const userId = await userIdFor(email);
    const { data: hidden } = await admin.from("hidden_vendors").select("merchant").eq("user_id", userId);
    expect(hidden).toEqual([{ merchant: "E2E Samples" }]);

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Account|e2e\.test/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Free Pizza Slice" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "E2E Free Sample Box" })).toHaveCount(0);
  });

  test("alert settings validate, save and persist", async ({ context, page }) => {
    const email = uniqueEmail("alerts");
    await signIn(context, page, email);

    await page.getByLabel("Email me new deals").check();
    for (const topic of [/^Games/, /^Food/, /^Instant-cancel/, /^Other freebies/]) await page.getByLabel(topic).uncheck();
    await page.getByRole("button", { name: "Save alert settings" }).click();
    await expect(page.getByText("Pick at least one topic")).toBeVisible();
    // A failed save must not reset what the visitor chose (regression: React 19 form reset).
    await expect(page.getByLabel("Email me new deals")).toBeChecked();

    await page.getByLabel(/^Games/).check();
    await page.getByLabel("Weekly, on Mondays").check();
    await page.getByRole("button", { name: "Save alert settings" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Email me new deals")).toBeChecked();
    await expect(page.getByLabel(/^Games/)).toBeChecked();
    await expect(page.getByLabel(/^Food/)).not.toBeChecked();
    await expect(page.getByLabel("Weekly, on Mondays")).toBeChecked();

    const { data } = await admin
      .from("alert_subscriptions")
      .select("email, topics, frequency, active")
      .eq("user_id", await userIdFor(email))
      .single();
    expect(data).toEqual({ email, topics: ["games"], frequency: "weekly", active: true });
  });

  test("the account page requires sign-in", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
  });
});
