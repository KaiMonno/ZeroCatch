-- ZeroCatch: retire the "Free With Purchase" category.
-- Purchase-required deals don't fit "zero catch", so the site now lists only
-- true freebies and instant-cancel trials. The enum value stays (Postgres
-- can't drop enum values cleanly) but no deal may use it.

delete from public.deals where category = 'free_with_purchase';

alter table public.deals
  add constraint no_purchase_required_deals
  check (category <> 'free_with_purchase');

-- Leads still suggesting it fall back to a plain freebie suggestion.
update public.deal_candidates
set suggested_category = 'pure_freebie'
where suggested_category = 'free_with_purchase';
