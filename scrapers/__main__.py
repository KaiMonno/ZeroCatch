"""Run every source, publish what's trusted, judge the rest, then clean up.

    python -m scrapers                   # fetch, judge, write to Supabase, clean up
    python -m scrapers --dry-run         # fetch and print; no database, no AI calls
    python -m scrapers --dry-run --judge # also call the AI judge on fresh leads (costs money)

Published directly (the source or file is the approval): Epic, curated
trials (data/trials.toml), fixed-date calendar freebies.
AI-judged (AI_JUDGE_MODE=shadow records verdicts; =publish acts on them):
blog and press-release leads.
Review queue: variable-date calendar entries, Steam, GOG.
"""

import argparse
import sys
from collections import Counter
from collections.abc import Callable
from datetime import datetime, timezone

from . import judge, supabase_rest
from .blogs import fetch_blog_leads, format_stats
from .calendar import fetch_calendar
from .epic import fetch_epic_deals
from .gog import fetch_gog_leads
from .steam import fetch_steam_leads
from .trials import KEY_PREFIX as TRIAL_PREFIX
from .trials import fetch_trial_deals


def _run(name: str, collector: Callable[[], object], errors: list[str], default: object) -> object:
    try:
        return collector()
    except Exception as err:  # one broken source shouldn't sink the run
        errors.append(f"{name}: {err}")
        return default


def apply_judge(leads: list[dict], mode: str, errors: list[str]) -> tuple[list[tuple[dict, dict]], Counter]:
    """Judge blog/press leads in place. Returns (lead, deal) pairs to publish
    (only in publish mode) and a tally of outcomes for the log."""
    to_publish: list[tuple[dict, dict]] = []
    tally: Counter = Counter()
    for lead in leads:
        if "_article_text" not in lead:
            continue  # not a judged source
        try:
            verdict, deal, reason = judge.judge_lead(lead, lead["_article_text"], lead["_links"])
        except Exception as err:
            tally["error"] += 1
            if tally["error"] == 1:
                errors.append(f"judge: {err}")
            continue  # stays a plain pending lead
        index = verdict.get("brand_link_index", -1)
        brand_url = lead["_links"][index][0] if isinstance(index, int) and 0 <= index < len(lead["_links"]) else None
        lead.update(
            ai_verdict={**verdict, "brand_url": brand_url, "decision": "publish" if deal else reason},
            ai_model=judge.MODEL,
            ai_judged_at=datetime.now(timezone.utc).isoformat(),
        )
        tally["would publish" if deal else reason] += 1
        if mode != "publish":
            continue
        if deal:
            to_publish.append((lead, deal))
        else:
            lead.update(status="rejected", review_note=reason, reviewed_at=datetime.now(timezone.utc).isoformat())
    return to_publish, tally


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="print results instead of writing")
    parser.add_argument("--judge", action="store_true", help="with --dry-run: also run the AI judge")
    parser.add_argument("--max-age-days", type=int, default=7, help="skip older blog posts (default 7)")
    args = parser.parse_args()

    errors: list[str] = []
    blog_stats: Counter = Counter()
    print("Collecting:")
    calendar_deals, calendar_leads = _run("calendar", fetch_calendar, errors, ([], []))
    leads = [
        *_run("blogs", lambda: fetch_blog_leads(args.max_age_days, blog_stats), errors, []),
        *calendar_leads,
        *_run("steam", fetch_steam_leads, errors, []),
        *_run("gog", fetch_gog_leads, errors, []),
    ]
    print(format_stats(blog_stats))
    epic_deals = _run("epic", fetch_epic_deals, errors, [])
    trial_deals = _run("trials", fetch_trial_deals, errors, [])
    mode = judge.judge_mode()

    if args.dry_run:
        for title, group in (("Epic", epic_deals), ("Curated trials", trial_deals), ("Calendar", calendar_deals)):
            for d in group:
                window = f"{d['starts_at'][:10]} → {d['expires_at'][:10]}" if d.get("expires_at") else "no end date"
                print(f"  ★ [{title}] {d['title']}  {window}")
        if args.judge and mode != "off":
            _, tally = apply_judge(leads, "shadow", errors)
            print(f"\nAI judge ({judge.MODEL}): {dict(tally)}")
            for lead in leads:
                if v := lead.get("ai_verdict"):
                    print(f"  {'✓' if v.get('qualifies') else '✗'} {v.get('rejection_reason')}/{v.get('confidence')}  {lead['title'][:80]}")
                    print(f"      decision={v.get('decision')}  link_index={v.get('brand_link_index')}  chosen={v.get('brand_url')}")
                    for i, (url, anchor) in enumerate(lead["_links"][:8]):
                        print(f"      [{i}] {url[:90]}  ({anchor[:40]})")
        print("\nLeads:")
        for row in leads:
            print(f"  {'🍔' if row['is_food'] else '  '} [{row['suggested_category']}] {row['title']}")
        print(f"\nAI judge mode: {mode}")
    else:
        # Separate calls: PostgREST bulk upserts need identical keys per row, and
        # trials omit starts_at so the column default applies.
        for label, group in (("Epic", epic_deals), ("curated trial", trial_deals), ("calendar", calendar_deals)):
            try:
                print(f"Published {supabase_rest.upsert_deals(group)} {label} deals")
            except supabase_rest.SupabaseError as err:
                errors.append(f"publish {label} deals: {err}")
        # Only sync when the trials file loaded; an empty list from a parse error
        # must not unpublish every trial.
        if not any(e.startswith("trials:") for e in errors):
            try:
                if removed := supabase_rest.delete_stale_deals(TRIAL_PREFIX, [d["source_key"] for d in trial_deals]):
                    print(f"Unpublished {removed} trials removed from trials.toml")
            except supabase_rest.SupabaseError as err:
                errors.append(f"sync trials: {err}")

        try:
            known = supabase_rest.existing_candidate_keys([lead["source_key"] for lead in leads])
            new_leads = [lead for lead in leads if lead["source_key"] not in known]
            to_publish, tally = apply_judge(new_leads, mode, errors) if mode != "off" else ([], Counter())
            if mode != "off":
                print(f"AI judge ({mode}, {judge.MODEL}): {dict(tally) or 'no new leads'}")
            inserted = {row["source_key"]: row["id"] for row in supabase_rest.insert_new_candidates(new_leads)}
            print(f"Queued {len(inserted)} new leads ({len(leads) - len(new_leads)} already known)")
            # Several posts often cover one promotion: publish each brand link once.
            published_urls = supabase_rest.live_deal_urls() if to_publish else set()
            for lead, deal in to_publish:
                if lead["source_key"] not in inserted:
                    continue
                if deal["url"] in published_urls:
                    print(f"  duplicate, left pending: {deal['title']}")
                    continue
                supabase_rest.approve_candidate(inserted[lead["source_key"]], deal)
                published_urls.add(deal["url"])
                print(f"  auto-published: {deal['title']}")
        except supabase_rest.SupabaseError as err:
            errors.append(f"queue leads: {err}")
        try:
            print(f"Housekeeping: {supabase_rest.run_housekeeping()}")
        except supabase_rest.SupabaseError as err:
            errors.append(f"housekeeping: {err}")

    for error in errors:
        print(f"ERROR {error}", file=sys.stderr)
    # Any error fails the workflow, so GitHub emails you. Good data from the
    # healthy sources is still written first.
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
