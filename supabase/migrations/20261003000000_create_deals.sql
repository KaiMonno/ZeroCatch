-- ZeroCatch: core deals schema
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

create type public.deal_category as enum (
  'pure_freebie',
  'free_trial',
  'free_with_purchase'
);

create table public.deals (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 200),
  description           text not null default '',
  category              public.deal_category not null,
  merchant              text not null,
  url                   text not null check (url ~* '^https://'),
  requires_account      boolean not null default false,
  requires_credit_card  boolean not null default false,
  instant_cancel_safe   boolean not null default false,
  trial_duration_days   integer check (trial_duration_days is null or trial_duration_days > 0),
  starts_at             timestamptz not null default now(),
  expires_at            timestamptz,
  is_hero_featured      boolean not null default false,
  created_at            timestamptz not null default now(),

  -- Stable identifier from the scraper (e.g. 'epic:weekly:2026-10-02') so
  -- GitHub Actions jobs and the seed script can upsert idempotently.
  source_key            text unique,

  -- Tab 1 is the "100% free" feed: a card requirement there is a data error.
  constraint pure_freebie_no_card
    check (category <> 'pure_freebie' or requires_credit_card = false),
  -- Tab 2 sorts by duration, so every trial must carry one.
  constraint trial_has_duration
    check (category <> 'free_trial' or trial_duration_days is not null),
  constraint expires_after_start
    check (expires_at is null or expires_at > starts_at)
);

create index deals_category_expires_idx on public.deals (category, expires_at);
create index deals_trial_duration_idx on public.deals (trial_duration_days desc)
  where category = 'free_trial';

-- Public, read-only access. Writes only happen with the service-role key
-- (seed script, GitHub Actions scrapers), which bypasses RLS.
alter table public.deals enable row level security;

create policy "Deals are publicly readable"
  on public.deals for select
  to anon, authenticated
  using (true);

-- The read contract shared by the web app and the future Expo app:
-- only deals that have started and have not expired.
create view public.active_deals
  with (security_invoker = true)
as
  select *
  from public.deals
  where starts_at <= now()
    and (expires_at is null or expires_at > now());

grant select on public.active_deals to anon, authenticated;
