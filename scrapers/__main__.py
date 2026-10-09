"""Run every source, publish what's trusted, judge the rest, then clean up.

    python -m scrapers                   # fetch, judge, write to Supabase, clean up
    python -m scrapers --dry-run         # fetch and print; no database, no AI calls
    python -m scrapers --dry-run --judge # also call the AI judge on fresh leads (costs money)

Published directly (the source or file is the approval): Epic, Steam
free-to-keep games (no DLC), the GOG giveaway, itch.io 100%-off games, curated trials
(data/trials.toml), fixed-date calendar freebies.
AI-judged (AI_JUDGE_MODE=shadow records verdicts; =publish acts on them;
=off queues them): press-release and Instagram brand-post leads.
Review queue: variable-date calendar entries.
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
from . import gog, instagram, itch, steam, trials


_attempted: list[str] = []
_failed: list[str] = []


def _run(name: str, collector: Callable[[], object], warnings: list[str], default: object) -> object:
    """Run one source. A source that can't be reached (after retries) is a warning,
    not a failure: tomorrow's run will catch up, and synced sources keep what's
    published when their fetch fails."""
    _attempted.append(name)
    try:
        return collector()
    except Exception as err:
        _failed.append(name)
        warnings.append(f"{name}: {err}")
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

    errors: list[str] = []  # writes that failed: the run fails and GitHub emails you
    warnings: list[str] = []  # sources that couldn't be reached: logged as annotations
    blog_stats: Counter = Counter()
    print("Collecting:")
    calendar_deals, calendar_leads = _run("calendar", fetch_calendar, warnings, ([], []))
    leads = [
        *_run("blogs", lambda: fetch_blog_leads(args.max_age_days, blog_stats, warnings), warnings, []),
        *calendar_leads,
        *_run("instagram", instagram.fetch_instagram_leads, warnings, []),
    ]
    print(format_stats(blog_stats))
    epic_deals = _run("epic", fetch_epic_deals, warnings, [])
    # Synced sources: whatever the source lists now is published, and anything
    # it stopped listing is unpublished. None means "fetch failed: don't sync".
    synced = {
        "steam": (steam.KEY_PREFIX, _run("steam", steam.fetch_steam_deals, warnings, None)),
        "gog": (gog.KEY_PREFIX, _run("gog", gog.fetch_gog_deals, warnings, None)),
        "itch": (itch.KEY_PREFIX, _run("itch", itch.fetch_itch_deals, warnings, None)),
        "trials": (trials.KEY_PREFIX, _run("trials", trials.fetch_trial_deals, warnings, None)),
    }
    mode = judge.judge_mode()

    if args.dry_run:
        groups = [("Epic", epic_deals), ("Calendar", calendar_deals)]
        groups += [(name, deals or []) for name, (_, deals) in synced.items()]
        for title, group in groups:
            for d in group:
                start = (d.get("starts_at") or "now")[:10]
                window = f"{start} → {d['expires_at'][:10]}" if d.get("expires_at") else "no end date"
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
        # synced sources omit starts_at so the column default applies.
        for label, group in (("Epic", epic_deals), ("calendar", calendar_deals)):
            try:
                print(f"Published {supabase_rest.upsert_deals(group)} {label} deals")
            except supabase_rest.SupabaseError as err:
                errors.append(f"publish {label} deals: {err}")
        for name, (prefix, deals) in synced.items():
            if deals is None:
                continue  # fetch failed: leave what's published untouched
            try:
                published = supabase_rest.upsert_deals(deals)
                removed = supabase_rest.delete_stale_deals(prefix, [d["source_key"] for d in deals])
                print(f"Synced {name}: {published} published, {removed} unpublished")
            except supabase_rest.SupabaseError as err:
                errors.append(f"sync {name}: {err}")
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

    # ::warning:: shows as an annotation on the run without failing it.
    for warning in warnings:
        print(f"::warning title=Source unavailable::{warning}")
    for error in errors:
        print(f"::error::{error}")
    # Fail (and get emailed) for broken writes, or when nothing could be fetched at all.
    every_source_failed = bool(_attempted) and len(_failed) == len(_attempted)
    return 1 if errors or every_source_failed else 0


if __name__ == "__main__":
    sys.exit(main())
