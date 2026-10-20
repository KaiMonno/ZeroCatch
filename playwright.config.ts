import { defineConfig, devices } from "@playwright/test";
import { ALERTS_SIGNING_SECRET, ANON_KEY, BASE_URL, E2E_PORT, SERVICE_KEY, SUPABASE_URL } from "./e2e/env";

/**
 * Browser tests against a production build wired to the local Supabase stack.
 *   npx supabase start && npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Mobile-first site: test at phone size. The accessibility spec also checks desktop.
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Fixtures go in before the build so the deal cache starts with them.
    command: `npx tsx e2e/seed-fixtures.ts && npx next build && npx next start -p ${E2E_PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      ALERTS_SIGNING_SECRET,
      ADMIN_PASSWORD: "e2e-admin-password",
    },
  },
});
