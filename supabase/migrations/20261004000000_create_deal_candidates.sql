-- ZeroCatch: review queue
-- Scrapers write leads into deal_candidates. Nothing reaches the public feed
-- until a human approves it, because a social or blog post can't confirm
-- "no card required" or "instant-cancel safe" on its own.

create type public.candidate_status as enum ('pending', 'approved', 'rejected');

create table public.deal_candidates (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null,                -- 'hip2save', 'manual', …
  source_key          text not null unique,         -- stable per post, e.g. 'hip2save:11796630'
  title               text not null,
  summary             text not null default '',
  source_url          text not null check (source_url ~* '^https?://'),
  source_categories   text[] not null default '{}',
  published_at        timestamptz,

  -- Scraper guesses, used to prefill the review form.
  is_food             boolean not null default false,
  suggested_category  public.deal_category,
  suggested_merchant  text,

  status              public.candidate_status not null default 'pending',
  deal_id             uuid references public.deals (id) on delete set null,
  review_note         text,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index deal_candidates_queue_idx
  on public.deal_candidates (status, is_food, published_at desc);

-- No policies: only the service role (scrapers, admin server actions) can
-- touch the queue. anon and authenticated get nothing.
alter table public.deal_candidates enable row level security;

-- Approve atomically: publish the deal and close out the candidate in one
-- transaction so a failure can't leave a published deal with a pending lead.
create function public.approve_candidate(p_candidate_id uuid, p_deal jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_source_key text;
  v_deal_id    uuid;
begin
  select source_key into v_source_key
  from deal_candidates
  where id = p_candidate_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Candidate % is not pending', p_candidate_id
      using errcode = 'P0002';
  end if;

  insert into deals (
    title, description, category, merchant, url,
    requires_account, requires_credit_card, instant_cancel_safe,
    trial_duration_days, starts_at, expires_at, is_hero_featured, source_key
  )
  select
    d.title, coalesce(d.description, ''), d.category, d.merchant, d.url,
    coalesce(d.requires_account, false), coalesce(d.requires_credit_card, false),
    coalesce(d.instant_cancel_safe, false), d.trial_duration_days,
    coalesce(d.starts_at, now()), d.expires_at, coalesce(d.is_hero_featured, false),
    v_source_key
  from jsonb_populate_record(null::deals, p_deal) as d
  returning id into v_deal_id;

  update deal_candidates
  set status = 'approved', deal_id = v_deal_id, reviewed_at = now()
  where id = p_candidate_id;

  return v_deal_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default. Lock it to the service role.
revoke execute on function public.approve_candidate(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.approve_candidate(uuid, jsonb) to service_role;
