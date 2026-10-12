-- ZeroCatch: signed-in users can mark deals as claimed, and claimed deals
-- drop out of their feed. Guests keep claims in a cookie that's merged here
-- when they sign in (see src/lib/claims.ts).

create table public.deal_claims (
  user_id     uuid not null references auth.users (id) on delete cascade,
  deal_id     uuid not null references public.deals (id) on delete cascade,
  claimed_at  timestamptz not null default now(),
  primary key (user_id, deal_id)
);

-- Each user sees and changes only their own claims.
alter table public.deal_claims enable row level security;

create policy "Users read their own claims"
  on public.deal_claims for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own claims"
  on public.deal_claims for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own claims"
  on public.deal_claims for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.deal_claims to authenticated;
-- my_active_deals runs as the caller, so anon needs to be able to *query* the
-- table; with no anon policy, RLS still returns zero rows.
grant select on public.deal_claims to anon;

-- The signed-in feed for any client (the web app filters a shared cache
-- instead; the future Expo app can read this directly). Anonymous callers have
-- no auth.uid(), so for them it's identical to active_deals.
create view public.my_active_deals
  with (security_invoker = true)
as
  select d.*
  from public.active_deals d
  where not exists (
    select 1 from public.deal_claims c
    where c.deal_id = d.id and c.user_id = (select auth.uid())
  );

grant select on public.my_active_deals to anon, authenticated;
