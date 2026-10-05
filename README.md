# ZeroCatch

**Good-Faith Freebies:** a deal aggregator that only lists verified, no-strings-attached offers. No affiliate junk, no hidden card traps.

| Tab | URL | What qualifies |
| --- | --- | --- |
| Pure Freebies | `/` | Free with no payment method. Account or promo code at most. |
| Instant-Cancel Trials | `/?tab=trials` | Trials you can cancel on day one and still keep the full period. Sorted longest first. |
| Free With Purchase | `/?tab=with-purchase` | BOGO and gift-with-purchase deals, kept out of the free feed. |

Search (`q`) and filter chips (`f=no-card,no-account,ending-soon`) live in the URL, so every view can be shared and is rendered on the server.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4) on Vercel · Supabase Postgres · Python scrapers on GitHub Actions cron · installable PWA.

## Getting started

```bash
npm install
npm run dev            # works immediately on local sample data
```

To use a real database:

1. Create a free Supabase project.
2. Run each file in `supabase/migrations/` in filename order (SQL editor or `supabase db push`).
3. `cp .env.example .env.local` and fill in the URL, anon (publishable) key, service-role (secret) key, and an admin password.
4. `npm run seed` upserts the 10 sample deals. It's idempotent because rows are keyed on `source_key`.

Sample deals in `src/data/seed-deals.ts` are illustrative. Verify each one's real terms before publishing it.

## Data model

`public.deals` holds the source of truth. Constraints enforce the feed's rules:

- `pure_freebie` rows can never require a credit card.
- `free_trial` rows must have `trial_duration_days`.
- URLs must be `https://`.

`public.active_deals` is a `security_invoker` view of deals that have started and haven't expired. It is the **read contract** for every client.

Row-level security allows `SELECT` for the anon role only. Writes go through the service-role key, used by the seed script and the scrapers.

## What qualifies

A deal is listed only if it's free (or a clearly stated BOGO / gift-with-purchase for Tab 3) and is **none** of:

- gated behind a **paid** membership (Prime, Circle 360, Walmart+, carrier perks, warehouse clubs, DashPass…). Free loyalty accounts are fine: that's the 🟡 Account Required badge
- a rebate or cash-back offer (you pay first)
- limited quantity ("first 50 customers")
- an in-store event or workshop
- for one audience only (teachers, students, military…)
- a contest or sweepstakes
- a roundup of many deals rather than one deal

The scrapers enforce these rules in `scrapers/classify.py`, and each rejection is logged with its reason code.

## Lead pipeline: mostly hands-off

```
GitHub Actions (nightly, 12:05am PT) ─▶ scrapers/
  ├─ trusted: published directly ────────────────────────────────────▶ deals ─▶ site
  │    Epic (first-party feed) · trials.toml · fixed-date food calendar
  ├─ judged: keyword rules ─▶ Claude Haiku 4.5 verdict ─▶ guardrails ─▶ deals
  │    Hip2Save · PR Newswire           (shadow mode: record only)
  └─ review queue (/admin/review): variable-date calendar entries, Steam, GOG
Visitors: "Report a problem" ─▶ 3 distinct reporters in 7 days hide a deal
```

| Source | Handling |
| --- | --- |
| Epic Games | Auto-published as hero. Next week's games are inserted early with a future `starts_at`, so the hero turns over on schedule |
| `scrapers/data/trials.toml` | The file is the approval: listed trials publish, removed ones unpublish |
| `scrapers/data/food_calendar.toml` | Fixed-date freebies publish 21 days ahead (hidden until the day); variable-date ones go to the queue to confirm the year's date |
| Hip2Save, PR Newswire | Inclusion rules drop ~90% for free; Claude Haiku 4.5 judges the rest |
| Steam, GOG | Review queue (DLC base-game and giveaway end dates need judgment) |

**AI judge** (`scrapers/judge.py`): one structured-output call per *new* lead (posts are never re-judged). It returns a verdict against the inclusion rules plus cleaned-up title, description, dates and an index into the links found in the article. It can't invent a URL. Deterministic guardrails then re-check dates, categories and the no-card rule, and only `high` confidence verdicts publish. A duplicate guard skips a deal whose brand link is already live. `AI_JUDGE_MODE` is a repository variable: `shadow` (default) records verdicts on the queue for comparison, and `publish` acts on them. Without an `ANTHROPIC_API_KEY` secret the judge is off. Expected cost at ~6 new leads/day is about $14/year.

**Reports:** every deal card has "Report a problem" (rate-limited to 5/hour per visitor, using salted IP hashes, so no IPs are stored). Three distinct reporters within a week hide the deal until an admin unhides or unpublishes it at `/admin/deals`.

- **Scrapers:** `python -m scrapers` (`--dry-run` to preview; `--dry-run --judge` also calls the AI). Robots.txt is honored on every fetch.
- **Housekeeping** (`run_housekeeping()`, nightly): auto-rejects leads pending for 14 days, deletes deals expired over 90 days ago, prunes login-failure records.
- **Admin auth:** single password, HMAC-signed cookie, lockout after 5 failed attempts per IP in 15 minutes.
- **Tests:** `python -m unittest discover -s scrapers/tests -t .`

## Project layout

```
src/app/            page (tabs via searchParams), layout, manifest, icons, loading/error
src/components/     DealCard, HeroCard, TabNav, SearchBar, FilterChips, BadgeLegend
src/lib/deals.ts    the only data-access module (Supabase query + local fallback)
src/lib/tabs.ts     tab and filter config, URL builder
src/app/admin/      review queue + published deals: login, server actions, shared deal form
supabase/           SQL migrations (run in filename order)
scrapers/           Python lead scrapers + unit tests
scripts/seed.ts     service-role upsert of sample data
.github/workflows/  nightly scrape job
```

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Web MVP: three tabs, badges, search and filters, PWA | Done (sample data) |
| 1.5 | Data pipeline: scrapers, AI judge, curated trials and calendar, reports | AI judge in shadow mode; Instagram needs a Meta developer account |
| 2 | Expo mobile app on the same Supabase backend | Planned |
| 3 | Accounts and "Mark as claimed" | Planned |

### Refresh schedule

GitHub Actions cron runs in UTC.

| Job | Cron (UTC) | Local time | Why |
| --- | --- | --- | --- |
| Daily refresh | `5 8 * * *` | 12:05am PST / 1:05am PDT | Picks up new deals overnight for every US time zone. Midnight Eastern would publish next-day deals at 9pm Pacific. |

Deals appear and disappear on time no matter how often scrapers run, because `active_deals` filters on `starts_at` and `expires_at` at query time. That's why Epic needs no Thursday run: next week's games are already stored with their start time. The schedule only controls how quickly brand-new deals are discovered.

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
