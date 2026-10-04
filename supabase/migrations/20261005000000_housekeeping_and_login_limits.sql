-- ZeroCatch: admin login rate limiting + nightly housekeeping

-- Failed admin logins, for rate limiting by IP. Service role only.
create table public.admin_login_failures (
  id            bigint generated always as identity primary key,
  ip            text not null,
  attempted_at  timestamptz not null default now()
);

create index admin_login_failures_ip_time_idx
  on public.admin_login_failures (ip, attempted_at desc);

alter table public.admin_login_failures enable row level security;

-- Nightly cleanup, called by the scraper job after it queues new leads.
--   * pending leads nobody reviewed in 14 days are stale: auto-reject them
--   * deals that expired over 90 days ago are deleted (their candidate rows
--     keep the history via deal_id ON DELETE SET NULL)
--   * login failures older than a day are no longer needed
create function public.run_housekeeping()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_rejected integer;
  v_deleted  integer;
  v_logins   integer;
begin
  update deal_candidates
  set status = 'rejected', reviewed_at = now(), review_note = 'auto: stale after 14 days'
  where status = 'pending' and created_at < now() - interval '14 days';
  get diagnostics v_rejected = row_count;

  delete from deals where expires_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;

  delete from admin_login_failures where attempted_at < now() - interval '1 day';
  get diagnostics v_logins = row_count;

  return jsonb_build_object(
    'stale_leads_rejected', v_rejected,
    'old_deals_deleted', v_deleted,
    'login_failures_pruned', v_logins
  );
end;
$$;

revoke execute on function public.run_housekeeping() from public, anon, authenticated;
grant execute on function public.run_housekeeping() to service_role;
