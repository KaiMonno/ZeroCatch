"""Epic Games Store weekly freebies → published deals (no review needed).

Epic's own promotions feed is first-party and exact: titles, links, and start
and end times come straight from the merchant, and every Epic freebie is
account-only with no payment method. So these skip the review queue.

Next week's games are listed in advance. They're inserted now with a future
starts_at, and the active_deals view keeps them hidden until the moment the
rotation happens, so the hero card turns over on time with no extra cron run.
"""

import json
import re
from datetime import datetime

from .fetch import fetch

FEED_URL = (
    "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions"
    "?locale=en-US&country=US&allowCountries=US"
)
STORE_URL = "https://store.epicgames.com/en-US/p/{slug}"
_HEX_ID = re.compile(r"^[0-9a-f]{32}$")


def _page_slug(element: dict) -> str | None:
    """Epic spreads the store slug across several fields depending on the product."""
    mappings = (element.get("catalogNs") or {}).get("mappings") or []
    for mapping in mappings + (element.get("offerMappings") or []):
        if mapping.get("pageSlug"):
            return mapping["pageSlug"]
    product_slug = (element.get("productSlug") or "").removesuffix("/home")
    if product_slug:
        return product_slug
    url_slug = element.get("urlSlug") or ""
    return url_slug if url_slug and not _HEX_ID.match(url_slug) else None


def _free_windows(element: dict) -> list[tuple[str, str]]:
    """(start, end) pairs for current and upcoming 100%-off offers.

    Epic encodes "free" as discountPercentage == 0 (i.e. pay 0% of the price).
    """
    promos = element.get("promotions") or {}
    windows = []
    for group in ("promotionalOffers", "upcomingPromotionalOffers"):
        for block in promos.get(group) or []:
            for offer in block.get("promotionalOffers") or []:
                if (offer.get("discountSetting") or {}).get("discountPercentage") == 0:
                    windows.append((offer["startDate"], offer["endDate"]))
    return windows


def _end_label(iso: str) -> str:
    when = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return f"{when:%b} {when.day}"


def parse_epic(payload: dict) -> list[dict]:
    elements = payload["data"]["Catalog"]["searchStore"]["elements"]
    deals = []
    for element in elements:
        title = (element.get("title") or "").strip()
        slug = _page_slug(element)
        # Holiday "Mystery Game" placeholders have no real title or page yet.
        if not title or not slug or "mystery game" in title.lower():
            continue
        for start, end in _free_windows(element):
            deals.append(
                {
                    "source_key": f"epic:{element['namespace']}:{element['id']}:{start[:10]}",
                    "title": title[:200],
                    "description": (
                        f"Free on the Epic Games Store until {_end_label(end)}. "
                        "Claim it with a free Epic account and it's yours to keep. No payment method needed."
                    ),
                    "category": "pure_freebie",
                    "merchant": "Epic Games",
                    "url": STORE_URL.format(slug=slug),
                    "requires_account": True,
                    "requires_credit_card": False,
                    "instant_cancel_safe": False,
                    "trial_duration_days": None,
                    "starts_at": start,
                    "expires_at": end,
                    "is_hero_featured": True,
                }
            )
    return deals


def fetch_epic_deals() -> list[dict]:
    deals = parse_epic(json.loads(fetch(FEED_URL)))
    print(f"  epic: {len(deals)} free-game windows (current + upcoming)")
    return deals
