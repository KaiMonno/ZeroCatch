-- Calendar leads are queued 21 days ahead so there's time to confirm them, but
-- housekeeping rejected every pending lead after 14 days, so they expired a
-- week before their date (2026's Veterans Day parks lead was rejected Nov 4).
--
-- Now:
--   - a lead whose date has passed is rejected ("auto: date passed");
--   - a lead for a date that's still ahead waits until that date is over;
--   - every other lead still goes stale after 14 days.

create or replace function public.run_housekeeping()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_passed   integer;
  v_rejected integer;
  v_deleted  integer;
  v_logins   integer;
  v_sign_ins integer;
begin
  update deal_candidates
  set status = 'rejected', reviewed_at = now(), review_note = 'auto: date passed'
  where status = 'pending' and suggested_expires_at < now();
  get diagnostics v_passed = row_count;

  update deal_candidates
  set status = 'rejected', reviewed_at = now(), review_note = 'auto: stale after 14 days'
  where status = 'pending'
    and created_at < now() - interval '14 days'
    -- Queued ahead of its date (calendar leads): keep it until the date is over.
    -- (coalesce: a lead without dates isn't one of those.)
    and not coalesce(
      suggested_starts_at > created_at + interval '1 day' and suggested_expires_at > now(),
      false
    );
  get diagnostics v_rejected = row_count;

  delete from deals where expires_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;

  delete from admin_login_failures where attempted_at < now() - interval '1 day';
  get diagnostics v_logins = row_count;

  delete from sign_in_email_requests where requested_at < now() - interval '1 day';
  get diagnostics v_sign_ins = row_count;

  return jsonb_build_object(
    'leads_past_their_date', v_passed,
    'stale_leads_rejected', v_rejected,
    'old_deals_deleted', v_deleted,
    'login_failures_pruned', v_logins,
    'sign_in_requests_pruned', v_sign_ins
  );
end;
$$;

-- Same lock-down as before: only the scrapers' service role runs it.
revoke execute on function public.run_housekeeping() from public, anon, authenticated;
grant execute on function public.run_housekeeping() to service_role;
