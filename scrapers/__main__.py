"""Run every source and queue new leads for review.

    python -m scrapers            # fetch and insert into deal_candidates
    python -m scrapers --dry-run  # fetch and print, no database needed
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

from .classify import classify
from .fetch import fetch
from .rss import parse_rss
from .sources import SOURCES
from .supabase_rest import insert_new_candidates


def collect(max_age_days: int) -> tuple[list[dict], list[str]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    rows: dict[str, dict] = {}
    errors: list[str] = []
    for source in SOURCES:
        try:
            items = parse_rss(fetch(source.url))
        except Exception as err:  # one broken feed shouldn't sink the run
            errors.append(f"{source.url}: {err}")
            continue

        kept = 0
        for item in items:
            c = classify(item.title, item.summary, item.categories, source.trusted_categories)
            if not c.keep or not item.link:
                continue
            # Feeds keep months of history; only fresh posts are actionable.
            if item.published_at and item.published_at < cutoff:
                continue
            key = f"{source.name}:{item.stable_id}"
            rows[key] = {
                "source": source.name,
                "source_key": key,
                "title": item.title[:200],
                "summary": item.summary,
                "source_url": item.link,
                "source_categories": item.categories,
                "published_at": item.published_at.isoformat() if item.published_at else None,
                "is_food": c.is_food,
                "suggested_category": c.suggested_category,
                "suggested_merchant": c.suggested_merchant,
            }
            kept += 1
        print(f"{source.url}: {len(items)} items, {kept} leads")
    return list(rows.values()), errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print leads instead of inserting")
    parser.add_argument("--max-age-days", type=int, default=7, help="skip older posts (default 7)")
    args = parser.parse_args()

    rows, errors = collect(args.max_age_days)
    if args.dry_run:
        for row in rows:
            food = "🍔" if row["is_food"] else "  "
            print(f"{food} [{row['suggested_category']}] {row['title']}  ({row['suggested_merchant'] or '-'})")
        print(f"{len(rows)} unique leads ({sum(r['is_food'] for r in rows)} food)")
    else:
        added = insert_new_candidates(rows)
        print(f"Queued {added} new leads ({len(rows) - added} already known)")

    for error in errors:
        print(f"ERROR {error}", file=sys.stderr)
    # Fail the workflow only if every source failed, so GitHub emails you.
    return 1 if errors and len(errors) == len(SOURCES) else 0


if __name__ == "__main__":
    sys.exit(main())
