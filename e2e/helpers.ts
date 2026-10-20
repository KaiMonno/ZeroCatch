import AxeBuilder from "@axe-core/playwright";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { ANON_KEY, BASE_URL, MAILPIT_URL, SERVICE_KEY, SUPABASE_URL } from "./env";

/** Service-role client for arranging and checking test data. */
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;

/** A deal card (or hero) by its title. */
export const dealCard = (page: Page, title: string) =>
  page.locator("article, section[aria-labelledby^='hero-']").filter({ has: page.getByRole("heading", { name: title }) });

/**
 * Signs in through the real magic-link flow (local Supabase → Mailpit →
 * /auth/callback), so guest data merges exactly as it does after Google
 * sign-in. Lands on `next`.
 */
export async function signIn(context: BrowserContext, page: Page, email: string, next = "/account") {
  // The PKCE code verifier is stored in a cookie by @supabase/ssr; hand it to the browser.
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${BASE_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) throw new Error(`signInWithOtp: ${error.message}`);
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: BASE_URL })));

  const link = await magicLink(email);
  await page.goto(link.replace(/&amp;/g, "&"));
  await page.waitForURL(`**${next}`);
}

async function magicLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages.length) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = message.Text.match(/https?:\/\/\S+verify\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic-link email for ${email} in Mailpit (${MAILPIT_URL})`);
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
