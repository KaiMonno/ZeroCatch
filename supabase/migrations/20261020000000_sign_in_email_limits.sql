-- ZeroCatch: email sign-in links. Requests are rate-limited so the form can't
-- be used to flood someone's inbox or burn the Resend quota that deal alerts
-- share. Only salted hashes are stored, never IPs or addresses. Service role only.

create table public.sign_in_email_requests (
  id            bigint generated always as identity primary key,
  ip_hash       text not null,
  email_hash    text not null,
  requested_at  timestamptz not null default now()
);

create index sign_in_email_requests_ip_idx on public.sign_in_email_requests (ip_hash, requested_at desc);
create index sign_in_email_requests_email_idx on public.sign_in_email_requests (email_hash, requested_at desc);
create index sign_in_email_requests_time_idx on public.sign_in_email_requests (requested_at desc);

alter table public.sign_in_email_requests enable row level security;
revoke all on public.sign_in_email_requests from anon, authenticated;

-- Nightly cleanup also prunes sign-in requests older than a day.
create or replace function public.run_housekeeping()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_rejected integer;
  v_deleted  integer;
  v_logins   integer;
  v_sign_ins integer;
begin
  update deal_candidates
  set status = 'rejected', reviewed_at = now(), review_note = 'auto: stale after 14 days'
  where status = 'pending' and created_at < now() - interval '14 days';
  get diagnostics v_rejected = row_count;

  delete from deals where expires_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;

  delete from admin_login_failures where attempted_at < now() - interval '1 day';
  get diagnostics v_logins = row_count;

  delete from sign_in_email_requests where requested_at < now() - interval '1 day';
  get diagnostics v_sign_ins = row_count;

  return jsonb_build_object(
    'stale_leads_rejected', v_rejected,
    'old_deals_deleted', v_deleted,
    'login_failures_pruned', v_logins,
    'sign_in_requests_pruned', v_sign_ins
  );
end;
$$;

revoke execute on function public.run_housekeeping() from public, anon, authenticated;
grant execute on function public.run_housekeeping() to service_role;
