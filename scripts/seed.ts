/**
 * Upsert sample deals into Supabase. Idempotent: rows are keyed on `source_key`.
 *   npm run seed
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { buildSeedDeals } from "../src/data/seed-deals";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function main(url: string, serviceKey: string) {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const deals = buildSeedDeals();

  const { data, error } = await supabase
    .from("deals")
    .upsert(deals, { onConflict: "source_key" })
    .select("title, category");

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data.length} deals:`);
  for (const d of data) console.log(`  [${d.category}] ${d.title}`);
}

main(url, serviceKey);
