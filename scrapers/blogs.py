"""Deal-blog RSS feeds → review-queue leads, filtered hard.

Pipeline per post: inclusion rules (classify.py) → freshness → the deal's date
(drop if already over, pre-schedule if upcoming) → the brand's own link from
the article (drop if none). Every drop is counted by reason so the filter's
effect is visible in the workflow log.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from .classify import MERCHANTS, classify
from .dates import day_window, find_deal_day
from .fetch import fetch
from .links import article_text, brand_links, pick_brand_link
from .rss import parse_rss
from .sources import RSS_SOURCES


def fetch_blog_leads(max_age_days: int, stats: Counter | None = None) -> list[dict]:
    stats = stats if stats is not None else Counter()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=max_age_days)
    rows: dict[str, dict] = {}

    for source in RSS_SOURCES:
        items = parse_rss(fetch(source.url))
        blog_host = urlsplit(source.url).netloc.removeprefix("www.")
        for item in items:
            key = f"{source.name}:{item.stable_id}"
            if key in rows or not item.link:
                continue  # already handled via the other feed
            if item.published_at and item.published_at < cutoff:
                continue  # old feed history, not counted as a rejection

            stats["seen"] += 1
            c = classify(item.title, item.summary, item.categories, source.trusted_categories)
            if not c.keep:
                stats[c.reject_reason] += 1
                continue

            day = find_deal_day(item.title, item.published_at) or find_deal_day(item.summary, item.published_at)
            starts_at = expires_at = None
            if day:
                start, end = day_window(day)
                if end < now:
                    stats["past_date"] += 1
                    continue
                expires_at = end.isoformat()
                if start > now:
                    starts_at = start.isoformat()

            merchant_domain = MERCHANTS[c.suggested_merchant][1] if c.suggested_merchant else None
            try:
                page = fetch(item.link).decode("utf-8", "replace")
                link = pick_brand_link(page, blog_host, merchant_domain)
            except Exception:
                page, link = "", None
            if not link:
                stats["no_brand_link"] += 1
                continue
            url, anchor = link

            stats["kept"] += 1
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
                "suggested_merchant": c.suggested_merchant or (anchor[:60] or None),
                "suggested_url": url,
                "suggested_starts_at": starts_at,
                "suggested_expires_at": expires_at,
                # Context for the AI judge; keys starting with "_" are never stored.
                "_article_text": article_text(page),
                "_links": [(u, a) for _, u, a in brand_links(page, blog_host)],
            }
    return list(rows.values())


def format_stats(stats: Counter) -> str:
    seen, kept = stats["seen"], stats["kept"]
    reasons = sorted(((k, v) for k, v in stats.items() if k not in ("seen", "kept")), key=lambda kv: -kv[1])
    lines = [f"  blogs: {seen} recent posts → {kept} leads ({kept / seen:.0%} kept)" if seen else "  blogs: no recent posts"]
    lines += [f"    rejected {v:>3} × {k}" for k, v in reasons]
    return "\n".join(lines)
