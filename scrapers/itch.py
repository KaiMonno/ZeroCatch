"""itch.io limited-time free games → published deals.

itch.io's official sale feed carries structured fields (discountpercent, price,
fullPrice, saleends), so a 100%-off game has an exact end date and needs no
review. A minimum original price keeps the very smallest titles out.
"""

import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

from .fetch import fetch

FEED_URL = "https://itch.io/games/on-sale.xml?page={page}"
PAGES = 5  # ~180 sale items; free-to-keep ones are a small fraction
MIN_FULL_PRICE = 3.99
KEY_PREFIX = "itch:"


def _price(text: str | None) -> float:
    try:
        return float((text or "").replace("$", "").replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def parse_feed(xml_bytes: bytes, min_full_price: float = MIN_FULL_PRICE) -> list[dict]:
    deals = []
    for item in ET.fromstring(xml_bytes).iterfind("./channel/item"):
        if item.findtext("discountpercent") != "100" or _price(item.findtext("price")) != 0:
            continue  # "[Free]" pay-what-you-want items aren't 100%-off sales
        full_price = _price(item.findtext("fullPrice"))
        ends = item.findtext("saleends")
        link = (item.findtext("link") or "").strip()
        title = (item.findtext("plainTitle") or "").strip()
        if full_price < min_full_price or not ends or not link.startswith("https://") or not title:
            continue
        expires = parsedate_to_datetime(ends)
        deals.append(
            {
                "source_key": f"{KEY_PREFIX}{link.removeprefix('https://')}",
                "title": f"{title}: Free on itch.io"[:200],
                "description": (
                    f"Normally ${full_price:.2f}. Free to download and keep until {expires:%b} {expires.day}. "
                    "No payment method needed; a free itch.io account is optional, for adding it to your library."
                ),
                "category": "pure_freebie",
                "merchant": "itch.io",
                "url": link,
                "requires_account": False,
                "requires_credit_card": False,
                "instant_cancel_safe": False,
                "trial_duration_days": None,
                "expires_at": expires.isoformat(),
                "is_hero_featured": False,
            }
        )
    return deals


def fetch_itch_deals() -> list[dict]:
    deals: dict[str, dict] = {}
    for page in range(1, PAGES + 1):
        for deal in parse_feed(fetch(FEED_URL.format(page=page))):
            deals[deal["source_key"]] = deal
        time.sleep(1)  # be polite between pages
    print(f"  itch: {len(deals)} free-to-keep games (original price ≥ ${MIN_FULL_PRICE})")
    return list(deals.values())
