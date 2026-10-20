import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ALERTS_SIGNING_SECRET } from "./env";
import { admin, uniqueEmail } from "./helpers";

/** Same format the Python sender signs (scrapers/alerts.py → unsubscribe_token). */
const tokenFor = (userId: string) =>
  `${userId}.${createHmac("sha256", ALERTS_SIGNING_SECRET).update(`unsubscribe:${userId}`).digest("base64url")}`;

async function subscriber() {
  const { data, error } = await admin.auth.admin.createUser({ email: uniqueEmail("unsub"), email_confirm: true });
  if (error) throw error;
  const userId = data.user.id;
  const { error: subError } = await admin.from("alert_subscriptions").insert({ user_id: userId });
  if (subError) throw subError;
  return userId;
}

const isActive = async (userId: string) =>
  (await admin.from("alert_subscriptions").select("active").eq("user_id", userId).single()).data?.active;

test.describe("unsubscribe", () => {
  test("the link in the email asks first, then unsubscribes", async ({ page }) => {
    const userId = await subscriber();
    await page.goto(`/unsubscribe?token=${encodeURIComponent(tokenFor(userId))}`);
    // Opening the link alone (as a mail scanner would) changes nothing.
    expect(await isActive(userId)).toBe(true);

    await page.getByRole("button", { name: "Yes, unsubscribe" }).click();
    await expect(page.getByRole("status")).toContainText("You're unsubscribed");
    expect(await isActive(userId)).toBe(false);
  });

  test("a forged link is refused", async ({ page }) => {
    const userId = await subscriber();
    const forged = `${userId}.${"A".repeat(43)}`;
    await page.goto(`/unsubscribe?token=${encodeURIComponent(forged)}`);
    await page.getByRole("button", { name: "Yes, unsubscribe" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /invalid/ })).toBeVisible();
    expect(await isActive(userId)).toBe(true);
  });

  test("one-click unsubscribe (RFC 8058) works for mail apps", async ({ request }) => {
    const userId = await subscriber();
    const forged = await request.post(`/api/alerts/unsubscribe?token=${encodeURIComponent(`${userId}.bad`)}`, {
      form: { "List-Unsubscribe": "One-Click" },
    });
    expect(forged.status()).toBe(400);
    expect(await isActive(userId)).toBe(true);

    const ok = await request.post(`/api/alerts/unsubscribe?token=${encodeURIComponent(tokenFor(userId))}`, {
      form: { "List-Unsubscribe": "One-Click" },
    });
    expect(ok.status()).toBe(200);
    expect(await isActive(userId)).toBe(false);
  });
});
