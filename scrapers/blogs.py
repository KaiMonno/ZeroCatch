"""Deal-blog RSS feeds → review-queue leads."""

from datetime import datetime, timedelta, timezone

from .classify import classify
from .fetch import fetch
from .rss import parse_rss
from .sources import RSS_SOURCES


def fetch_blog_leads(max_age_days: int) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    rows: dict[str, dict] = {}
    for source in RSS_SOURCES:
        items = parse_rss(fetch(source.url))
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
        print(f"  {source.url}: {len(items)} items, {kept} leads")
    return list(rows.values())
