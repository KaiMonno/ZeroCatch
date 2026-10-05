"""GOG homepage giveaway → published deal.

The giveaway banner's link is in the server-rendered HTML, and the product's
title is in the page's embedded JSON. The countdown is drawn client-side, so
there's no end date: the nightly sync unpublishes the deal once the banner is gone.
"""

import json
import re

from .fetch import fetch

HOME_URL = "https://www.gog.com/en/"
KEY_PREFIX = "gog:"
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
        "source_key": f"{KEY_PREFIX}giveaway:{slug}",
        "title": f"{title}: Free on GOG"[:200],
        "description": "GOG giveaway: claim it from the banner on the GOG homepage while signed in and it's yours to keep, DRM-free. Free GOG account needed; no payment method.",
        "category": "pure_freebie",
        "merchant": "GOG",
        "url": url,
        "requires_account": True,
        "requires_credit_card": False,
        "instant_cancel_safe": False,
        "trial_duration_days": None,
        "expires_at": None,
        "is_hero_featured": False,
    }


def fetch_gog_deals() -> list[dict]:
    deal = parse_giveaway(fetch(HOME_URL).decode("utf-8", "replace"))
    print(f"  gog: {'1 giveaway' if deal else 'no giveaway running'}")
    return [deal] if deal else []
