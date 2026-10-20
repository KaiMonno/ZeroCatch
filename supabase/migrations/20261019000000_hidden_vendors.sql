-- ZeroCatch: visitors can hide a vendor (a deal's merchant, e.g. "itch.io")
-- so its deals never show in their feed or alert emails. Guests keep the list
-- in a cookie that's merged here when they sign in (see src/lib/claims.ts).

create table public.hidden_vendors (
  user_id    uuid not null references auth.users (id) on delete cascade,
  merchant   text not null check (char_length(merchant) between 1 and 80),
  hidden_at  timestamptz not null default now(),
  primary key (user_id, merchant)
);

-- Each user sees and changes only their own list. The alert sender reads it
-- with the service role.
alter table public.hidden_vendors enable row level security;

create policy "Users read their own hidden vendors"
  on public.hidden_vendors for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users hide vendors for themselves"
  on public.hidden_vendors for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users unhide their own vendors"
  on public.hidden_vendors for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.hidden_vendors from anon, authenticated;
grant select, insert, delete on public.hidden_vendors to authenticated;
-- my_active_deals runs as the caller, so anon needs to be able to *query* the
-- table; with no anon policy, RLS still returns zero rows.
grant select on public.hidden_vendors to anon;

-- The signed-in feed now also drops hidden vendors.
create or replace view public.my_active_deals
  with (security_invoker = true)
as
  select d.*
  from public.active_deals d
  where not exists (
    select 1 from public.deal_claims c
    where c.deal_id = d.id and c.user_id = (select auth.uid())
  )
  and not exists (
    select 1 from public.hidden_vendors h
    where h.merchant = d.merchant and h.user_id = (select auth.uid())
  );
