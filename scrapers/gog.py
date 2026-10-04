"""GOG homepage giveaway → review-queue lead.

The giveaway banner's link is in the server-rendered HTML, and the product's
title is in the page's embedded JSON. The countdown is drawn client-side,
so the end date has to come from a reviewer.
"""

import json
import re
from datetime import datetime, timezone

from .fetch import fetch

HOME_URL = "https://www.gog.com/en/"
_OVERLAY_RE = re.compile(r'class="giveaway__overlay-link"[^>]*href="(https://www\.gog\.com/[^"]*/game/([\w-]+))"')
_TITLE_RE = re.compile(r'"title":"((?:[^"\\]|\\.)+)"')


def parse_giveaway(page: str) -> dict | None:
    match = _OVERLAY_RE.search(page)
    if not match:
        return None
    url, slug = match.groups()

    # The product JSON lists "title" shortly before "slug"; take the nearest one.
    title = slug.replace("_", " ").title()
    slug_at = page.find(f'"slug":"{slug}"')
    if slug_at > 0:
        titles = _TITLE_RE.findall(page[max(0, slug_at - 3000) : slug_at])
        if titles:
            title = json.loads(f'"{titles[-1]}"')  # decode JSON escapes like \u2122

    return {
        "source": "gog",
        "source_key": f"gog:giveaway:{slug}",
        "title": f"GOG giveaway: {title}"[:200],
        "summary": (
            "Free to keep: claim it from the giveaway banner on the GOG homepage while signed in. "
            "The end time is only shown on gog.com, so check it there."
        ),
        "source_url": url,
        "source_categories": ["Giveaway"],
        "published_at": datetime.now(timezone.utc).isoformat(),  # no post date; use first seen
        "is_food": False,
        "suggested_category": "pure_freebie",
        "suggested_merchant": "GOG",
    }


def fetch_gog_leads() -> list[dict]:
    lead = parse_giveaway(fetch(HOME_URL).decode("utf-8", "replace"))
    print(f"  gog: {'1 giveaway' if lead else 'no giveaway running'}")
    return [lead] if lead else []
