/**
 * Replaces the browser tests' fixture deals (source_key "e2e:*") in the local
 * database. Runs before the test server is built, so the deal cache starts
 * with them. Tests only assert on these titles, so leftover local data is fine.
 */
import { createClient } from "@supabase/supabase-js";
import { SERVICE_KEY, SUPABASE_URL } from "./env";

const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const base = {
  description: "Fixture deal for the browser tests.",
  url: "https://example.com/deal",
  requires_account: false,
  requires_credit_card: false,
  instant_cancel_safe: true,
  trial_duration_days: null,
  starts_at: hours(-24),
  expires_at: null,
  is_hero_featured: false,
  category: "pure_freebie",
};

export const FIXTURES = [
  { ...base, source_key: "e2e:hero", title: "E2E Hero Game", merchant: "E2E Games Store", requires_account: true, is_hero_featured: true, expires_at: hours(72) },
  { ...base, source_key: "e2e:pizza", title: "E2E Free Pizza Slice", merchant: "E2E Pizza Co", expires_at: hours(20) },
  { ...base, source_key: "e2e:samples", title: "E2E Free Sample Box", merchant: "E2E Samples", requires_account: true },
  ...[1, 2, 3].map((i) => ({ ...base, source_key: `e2e:itch-${i}`, title: `E2E Itch Game ${i}`, merchant: "itch.io", expires_at: hours(96) })),
  { ...base, source_key: "e2e:trial-long", category: "free_trial", title: "E2E Long Trial", merchant: "E2E Streaming", requires_account: true, requires_credit_card: true, trial_duration_days: 90 },
  { ...base, source_key: "e2e:trial-short", category: "free_trial", title: "E2E Short Trial", merchant: "E2E Learning", requires_account: true, trial_duration_days: 7 },
];

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error: delError } = await db.from("deals").delete().like("source_key", "e2e:%");
  if (delError) throw new Error(`clearing fixtures: ${delError.message}`);
  const { error } = await db.from("deals").insert(FIXTURES);
  if (error) throw new Error(`inserting fixtures: ${error.message}`);
  console.log(`e2e: ${FIXTURES.length} fixture deals ready`);
}

main().catch((err) => {
  console.error(err.message);
  console.error("Is the local Supabase stack running? `npx supabase start`");
  process.exit(1);
});
