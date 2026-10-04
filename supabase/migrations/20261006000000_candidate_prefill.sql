-- ZeroCatch: let scrapers prefill the review form so approving is one click.

alter table public.deal_candidates
  add column suggested_url         text check (suggested_url is null or suggested_url ~* '^https://'),
  add column suggested_starts_at   timestamptz,
  add column suggested_expires_at  timestamptz;
