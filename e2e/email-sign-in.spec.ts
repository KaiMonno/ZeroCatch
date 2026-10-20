import { expect, test } from "@playwright/test";
import {
  asNewVisitor,
  emailCount,
  expectNoA11yViolations,
  latestSignInEmail,
  requestSignInEmail,
  uniqueEmail,
} from "./helpers";

test.describe("email sign-in", () => {
  test.beforeEach(async ({ page }) => asNewVisitor(page));

  test("the link works on another device, needs a tap, and works only once", async ({ page, browser }) => {
    const email = uniqueEmail("link");
    await requestSignInEmail(page, email, "/account");
    const mail = await latestSignInEmail(email);
    expect(mail.subject).toBe("Your ZeroCatch sign-in link");

    // A different browser (the phone, say) with none of the first browser's cookies.
    const phone = await browser.newContext();
    const phonePage = await phone.newPage();
    await phonePage.goto(mail.link);
    await phonePage.reload(); // a mail scanner opening the link doesn't use it up
    await phonePage.getByRole("button", { name: "Continue to ZeroCatch" }).click();
    await phonePage.waitForURL("**/account");
    await expect(phonePage.getByRole("heading", { name: "Your account" })).toBeVisible();
    await expect(phonePage.getByRole("paragraph").filter({ hasText: new RegExp(`^${email}$`) })).toBeVisible();
    await phone.close();

    // Used once: a second attempt explains what happened.
    await page.goto(mail.link);
    await page.getByRole("button", { name: "Continue to ZeroCatch" }).click();
    await expect(page).toHaveURL(/\/login\?error=link/);
    await expect(page.getByRole("alert").filter({ hasText: "expired or was already used" })).toBeVisible();
  });

  test("the code signs in on the same screen, and a wrong code is refused", async ({ page }) => {
    const email = uniqueEmail("code");
    await requestSignInEmail(page, email, "/?tab=trials");
    const { code } = await latestSignInEmail(email);
    const wrong = code.replace(/\d$/, (d) => String((Number(d) + 1) % 10));

    const box = page.getByLabel("Code from the email");
    await box.fill(wrong);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();

    await box.fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/?tab=trials");
    await expect(page.getByRole("link", { name: /Account|e2e\.test/ })).toBeVisible();
  });

  test("can switch address, and repeated requests for one address are limited", async ({ page }) => {
    const email = uniqueEmail("limit");
    await requestSignInEmail(page, email); // 1
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);

    await page.waitForTimeout(1_100); // the local stack allows one email per address per second (production: per minute)
    await page.getByRole("button", { name: "Email me a sign-in link" }).click(); // 2
    await expect(page.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible();
    for (const n of [3, 4]) {
      await page.waitForTimeout(1_100);
      const before = await emailCount(email);
      await page.getByRole("button", { name: "Send a new email" }).click();
      if (n === 3) await expect.poll(() => emailCount(email)).toBeGreaterThan(before);
    }
    // The 4th request in an hour is refused, and the address stays filled in.
    await expect(page.getByRole("alert").filter({ hasText: "a lot of sign-in emails" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  });

  test("login and confirm screens have no accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page, "login");
    const email = uniqueEmail("a11y-login");
    await requestSignInEmail(page, email);
    await expectNoA11yViolations(page, "login, code step");
    await page.goto((await latestSignInEmail(email)).link);
    await expectNoA11yViolations(page, "confirm link");
  });
});
