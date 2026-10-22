import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { MAILPIT_URL, SERVICE_KEY, SUPABASE_URL } from "./env";

/** Service-role client for arranging and checking test data. */
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;

/** A deal card (or hero) by its title. */
export const dealCard = (page: Page, title: string) =>
  page.locator("article, section[aria-labelledby^='hero-']").filter({ has: page.getByRole("heading", { name: title }) });

/** Opens a deal's ⋯ menu (hide vendor, report a problem) and returns the card. */
export async function openCardMenu(page: Page, title: string) {
  const card = dealCard(page, title);
  await card.getByRole("button", { name: `More options for ${title}` }).click();
  return card;
}

/**
 * Each test gets its own "IP" so the per-visitor sign-in email limit (5/hour)
 * doesn't leak between tests. The app reads x-forwarded-for, as on Vercel.
 */
export async function asNewVisitor(page: Page) {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

export interface SignInEmail {
  subject: string;
  link: string;
  code: string;
}

/** The newest sign-in email for `email` in Mailpit (the local stack's inbox). */
export async function latestSignInEmail(email: string, afterCount = 0): Promise<SignInEmail> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages.length > afterCount) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json()) as {
        Subject: string;
        HTML: string;
      };
      const link = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1];
      const code = message.HTML.match(/>\s*(\d{6,10})\s*</)?.[1];
      if (!link || !code) throw new Error(`sign-in email without link or code:\n${message.HTML}`);
      return { subject: message.Subject, link: link.replace(/&amp;/g, "&"), code };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in email for ${email} in Mailpit (${MAILPIT_URL})`);
}

/** How many emails Mailpit holds for `email` (to wait for the next one). */
export async function emailCount(email: string): Promise<number> {
  const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  return ((await search.json()) as { messages?: unknown[] }).messages?.length ?? 0;
}

/** Asks for a sign-in email on /login, as a visitor would. */
export async function requestSignInEmail(page: Page, email: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible();
}

/**
 * Signs in the way a visitor does with email: /login → email → link →
 * "Continue". Guest data in this browser merges into the account. Lands on `next`.
 */
export async function signIn(page: Page, email: string, next = "/account") {
  await asNewVisitor(page);
  await requestSignInEmail(page, email, next);
  const { link } = await latestSignInEmail(email);
  await page.goto(link);
  await page.getByRole("button", { name: "Continue to ZeroCatch" }).click();
  await page.waitForURL(`**${next}`);
}

/** The signed-in user's id, looked up by email. */
export async function userIdFor(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`no user ${email}`);
  return user.id;
}

/**
 * WCAG 2.2 A/AA checks with axe. Fails with a readable list of each rule,
 * its impact and the offending elements.
 */
export async function expectNoA11yViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const report = violations.map(
    (v) => `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n    ")}`,
  );
  expect(report, `${label}: accessibility violations`).toEqual([]);
}
