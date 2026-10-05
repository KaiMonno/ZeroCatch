-- ZeroCatch: AI judge verdicts on leads, and public "Report a problem".

-- The judge's structured verdict, kept for auditing (and for shadow mode,
-- where verdicts are recorded but nothing is auto-published).
alter table public.deal_candidates
  add column ai_verdict    jsonb,
  add column ai_model      text,
  add column ai_judged_at  timestamptz;

-- A deal enough people report as broken is hidden until an admin looks.
alter table public.deals add column hidden_at timestamptz;

-- Re-create the public read contract to also exclude hidden deals. (Dropped
-- and re-created rather than replaced: `select *` gains the new column.)
drop view public.active_deals;
create view public.active_deals
  with (security_invoker = true)
as
  select *
  from public.deals
  where starts_at <= now()
    and (expires_at is null or expires_at > now())
    and hidden_at is null;

grant select on public.active_deals to anon, authenticated;

create table public.deal_reports (
  id             bigint generated always as identity primary key,
  deal_id        uuid not null references public.deals (id) on delete cascade,
  reason         text not null check (reason in ('expired', 'broken_link', 'has_catch', 'other')),
  note           text check (char_length(note) <= 500),
  -- Salted hash of the reporter's IP: enough to rate-limit and count distinct
  -- reporters without storing the address itself.
  reporter_hash  text not null,
  created_at     timestamptz not null default now()
);

create index deal_reports_deal_idx on public.deal_reports (deal_id, created_at desc);
create index deal_reports_reporter_idx on public.deal_reports (reporter_hash, created_at desc);

-- Server actions write with the service role; the public gets no access.
alter table public.deal_reports enable row level security;
