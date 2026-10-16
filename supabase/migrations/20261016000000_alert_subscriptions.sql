-- ZeroCatch: email alerts for new deals. Signed-in users opt in from /account;
-- the nightly job (scrapers/alerts.py) sends digests with the service role.

create table public.alert_subscriptions (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topics        text[] not null default '{games,food,trials,other}'
                  check (topics <@ array['games', 'food', 'trials', 'other']::text[] and cardinality(topics) > 0),
  frequency     text not null default 'daily' check (frequency in ('daily', 'weekly')),
  active        boolean not null default true,
  last_sent_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index alert_subscriptions_active_idx on public.alert_subscriptions (active, frequency);

-- Users manage only their own subscription. Sending and token-based
-- unsubscribes use the service role.
alter table public.alert_subscriptions enable row level security;

create policy "Users read their own alert settings"
  on public.alert_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create their own alert settings"
  on public.alert_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own alert settings"
  on public.alert_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own alert settings"
  on public.alert_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Column-level grants: users choose topics, frequency and on/off. They can't
-- write `email` (or anyone could point alerts at someone else's inbox) or
-- `last_sent_at`. Supabase's default privileges grant everything on new
-- tables, so revoke first or the column limits below would be meaningless.
revoke all on public.alert_subscriptions from anon, authenticated;
grant select, delete on public.alert_subscriptions to authenticated;
grant insert (user_id, topics, frequency, active) on public.alert_subscriptions to authenticated;
grant update (topics, frequency, active) on public.alert_subscriptions to authenticated;

-- The address always comes from the user's own verified sign-in.
create function public.alert_subscriptions_set_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := (select u.email from auth.users u where u.id = new.user_id);
  if new.email is null then
    raise exception 'No email on file for this account';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.alert_subscriptions_set_email() from public, anon, authenticated;

create trigger alert_subscriptions_set_email
  before insert or update on public.alert_subscriptions
  for each row execute function public.alert_subscriptions_set_email();
