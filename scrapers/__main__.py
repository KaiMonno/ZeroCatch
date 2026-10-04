"""Run every source, then nightly housekeeping.

    python -m scrapers            # fetch, write to Supabase, clean up
    python -m scrapers --dry-run  # fetch and print, no database needed

Lead sources (blogs and press releases, Steam, GOG, the food calendar) go to
the review queue. Epic is first-party data and is published directly.
"""

import argparse
import sys
from collections import Counter
from collections.abc import Callable

from . import supabase_rest
from .blogs import fetch_blog_leads, format_stats
from .calendar import fetch_calendar_leads
from .epic import fetch_epic_deals
from .gog import fetch_gog_leads
from .steam import fetch_steam_leads


def _run(name: str, collector: Callable[[], list[dict]], errors: list[str]) -> list[dict]:
    try:
        return collector()
    except Exception as err:  # one broken source shouldn't sink the run
        errors.append(f"{name}: {err}")
        return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print results instead of writing")
    parser.add_argument("--max-age-days", type=int, default=7, help="skip older blog posts (default 7)")
    args = parser.parse_args()

    errors: list[str] = []
    blog_stats: Counter = Counter()
    print("Collecting:")
    leads = [
        *_run("blogs", lambda: fetch_blog_leads(args.max_age_days, blog_stats), errors),
        *_run("calendar", fetch_calendar_leads, errors),
        *_run("steam", fetch_steam_leads, errors),
        *_run("gog", fetch_gog_leads, errors),
    ]
    print(format_stats(blog_stats))
    deals = _run("epic", fetch_epic_deals, errors)

    if args.dry_run:
        print("\nAuto-published deals:")
        for d in deals:
            print(f"  ★ {d['title']}  {d['starts_at'][:10]} → {d['expires_at'][:10]}  {d['url']}")
        print("\nLeads for review:")
        for row in leads:
            food = "🍔" if row["is_food"] else "  "
            print(f"  {food} [{row['suggested_category']}] {row['title']}  ({row['suggested_merchant'] or '-'})")
            if row.get("suggested_url"):
                print(f"       → {row['suggested_url']}  {row.get('suggested_starts_at') or ''} {row.get('suggested_expires_at') or ''}")
        print(f"\n{len(deals)} deals, {len(leads)} leads ({sum(r['is_food'] for r in leads)} food)")
    else:
        try:
            print(f"\nPublished {supabase_rest.upsert_deals(deals)} first-party deals")
        except supabase_rest.SupabaseError as err:
            errors.append(f"publish deals: {err}")
        try:
            added = supabase_rest.insert_new_candidates(leads)
            print(f"Queued {added} new leads ({len(leads) - added} already known)")
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
