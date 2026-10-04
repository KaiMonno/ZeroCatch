# ZeroCatch

**Good-Faith Freebies:** a deal aggregator that only lists verified, no-strings-attached offers. No affiliate junk, no hidden card traps.

| Tab | URL | What qualifies |
| --- | --- | --- |
| Pure Freebies | `/` | Free with no payment method. Account or promo code at most. |
| Instant-Cancel Trials | `/?tab=trials` | Trials you can cancel on day one and still keep the full period. Sorted longest first. |
| Free With Purchase | `/?tab=with-purchase` | BOGO and gift-with-purchase deals, kept out of the free feed. |

Search (`q`) and filter chips (`f=no-card,no-account,ending-soon`) live in the URL, so every view can be shared and is rendered on the server.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4) on Vercel · Supabase Postgres · Python scrapers on GitHub Actions cron (planned) · installable PWA.

## Getting started

```bash
npm install
npm run dev            # works immediately on local sample data
```

To use a real database:

1. Create a free Supabase project.
2. Run `supabase/migrations/20261003000000_create_deals.sql` (SQL editor or `supabase db push`).
3. `cp .env.example .env.local` and fill in the URL, anon key, and service-role key.
4. `npm run seed` upserts the 10 sample deals. It's idempotent because rows are keyed on `source_key`.

Sample deals in `src/data/seed-deals.ts` are illustrative. Verify each one's real terms before publishing it.

## Data model

`public.deals` holds the source of truth. Constraints enforce the feed's rules:

- `pure_freebie` rows can never require a credit card.
- `free_trial` rows must have `trial_duration_days`.
- URLs must be `https://`.

`public.active_deals` is a `security_invoker` view of deals that have started and haven't expired. It is the **read contract** for every client.

Row-level security allows `SELECT` for the anon role only. Writes go through the service-role key, used by the seed script and the scrapers.

## Project layout

```
src/app/            page (tabs via searchParams), layout, manifest, icons, loading/error
src/components/     DealCard, HeroCard, TabNav, SearchBar, FilterChips, BadgeLegend
src/lib/deals.ts    the only data-access module (Supabase query + local fallback)
src/lib/tabs.ts     tab and filter config, URL builder
supabase/           SQL migrations
scripts/seed.ts     service-role upsert of sample data
```

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Web MVP: three tabs, badges, search and filters, PWA | Done (sample data) |
| 1.5 | Data pipeline: Python scrapers on GitHub Actions cron, plus a curated deals file | Next |
| 2 | Expo mobile app on the same Supabase backend | Planned |
| 3 | Accounts and "Mark as claimed" | Planned |

### Refresh schedule (planned)

GitHub Actions cron runs in UTC.

| Job | Cron (UTC) | Local time | Why |
| --- | --- | --- | --- |
| Daily refresh | `5 8 * * *` | 12:05am PST / 1:05am PDT | Picks up new deals overnight for every US time zone. Midnight Eastern would publish next-day deals at 9pm Pacific. |
| Epic weekly drop | `15 16 * * 4` | Thu after 11am ET | Epic rotates Thursdays at 11am ET. Without this run the hero card would be empty until midnight. |

Deals disappear on time no matter how often scrapers run, because `active_deals` filters on `expires_at` at query time. The schedule only controls how quickly new deals appear.

### Phase 3: accounts and "Mark as claimed"

Signed-in users can mark a deal as claimed, and it disappears from their feed.

- **Auth:** Supabase Auth with magic link plus Google/Apple sign-in, all on the free tier.
- **Table:** `deal_claims (user_id → auth.users, deal_id → deals ON DELETE CASCADE, claimed_at, PRIMARY KEY (user_id, deal_id))`. RLS limits each user to reading and writing their own rows.
- **Feed:** a `security_invoker` view adds `NOT EXISTS (… c.user_id = auth.uid())` on top of `active_deals`. Logged-out users get `auth.uid()` = null and see everything, so one view serves both cases, and the Expo app gets the feature at no extra cost.
- **UX:** a "Claimed ✓" button on each card with an undo toast, plus a "Show claimed" toggle.
- **Recurring deals:** claims are tied to the deal row, so claiming this week's Epic game doesn't hide next week's.
- **Optional guest mode:** keep claims in `localStorage` and merge them into the account on sign-up.

## Phase 2: Expo app

There is no custom API layer to rebuild. A React Native app can create a Supabase client with the same public anon key and query `active_deals` with the same filters as `src/lib/deals.ts`. RLS already keeps that key read-only. If the logic grows, the query builder in `deals.ts` can move into a shared package that both apps import.
