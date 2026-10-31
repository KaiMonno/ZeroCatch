"""Steam free-to-keep promotions → published deals.

Steam's search for "free + on special" finds 100%-off items. DLC is excluded:
it only works with a base game you'd have to buy. Only items Steam's own API
confirms as full games at 100% off are published. The API has no end date, but
the store page says "Free to keep when you get it before Nov 2 @ 10:00am"
(Pacific time), so the deal leaves the feed on time instead of lingering until
the next nightly sync. If the page doesn't say, the sync unpublishes the game
once it drops out of the search.
"""

import json
import re
from datetime import datetime, timedelta, timezone
from html import unescape

from .dates import _MONTHS, PACIFIC
from .fetch import fetch

SEARCH_URL = (
    "https://store.steampowered.com/search/results/"
    "?maxprice=free&specials=1&infinite=1&cc=us&l=english&count=50"
)
DETAILS_URL = "https://store.steampowered.com/api/appdetails?appids={appid}&cc=us&l=english"
PAGE_URL = "https://store.steampowered.com/app/{appid}/?cc=us&l=english"
_ROW_RE = re.compile(
    r'<a href="(https://store\.steampowered\.com/app/(\d+)/[^"?]*)[^"]*".*?<span class="title">([^<]+)</span>',
    re.S,
)
_FREE_UNTIL_RE = re.compile(
    r"Free to keep when you get it before ([A-Za-z]{3,9})\.? (\d{1,2}) @ (\d{1,2}):(\d{2}) ?([ap]m)", re.I
)
MAX_ITEMS = 20  # keeps appdetails calls well under Steam's rate limits
KEY_PREFIX = "steam:"


def parse_search(results_html: str) -> list[tuple[str, str, str]]:
    """(appid, name, url) for each app row. Packages/bundles are skipped."""
    seen, rows = set(), []
    for url, appid, name in _ROW_RE.findall(results_html):
        if appid not in seen:
            seen.add(appid)
            rows.append((appid, unescape(name).strip(), url))
    return rows


def parse_free_until(page: str, now: datetime | None = None) -> datetime | None:
    """When a free-to-keep promo ends, from the store page's Pacific-time notice."""
    match = _FREE_UNTIL_RE.search(page)
    if not match:
        return None
    month_name, day, hour, minute, meridiem = match.groups()
    month = _MONTHS.get(month_name.lower())
    if not month or not 1 <= int(hour) <= 12:
        return None
    hour = int(hour) % 12 + (12 if meridiem.lower() == "pm" else 0)
    now = (now or datetime.now(timezone.utc)).astimezone(PACIFIC)
    # The notice has no year: it's the next such date, so "Jan 2" seen in December is next year.
    for year in (now.year, now.year + 1):
        try:
            ends = datetime(year, month, int(day), hour, int(minute), tzinfo=PACIFIC)
        except ValueError:
            return None
        if ends > now - timedelta(days=1):
            return ends.astimezone(timezone.utc)
    return None


def build_deal(
    appid: str, name: str, url: str, details: dict | None, ends_at: datetime | None = None
) -> dict | None:
    """A publishable deal, or None for DLC, soundtracks, or anything not 100% off right now."""
    if not details or details.get("type") != "game":
        return None
    # The search can lag the store: a promo that just ended still shows up for a while.
    if (details.get("price_overview") or {}).get("discount_percent") != 100:
        return None
    local_end = ends_at.astimezone(PACIFIC) if ends_at else None
    until = f" until {local_end:%b} {local_end.day}" if local_end else " for a limited time"
    return {
        "source_key": f"{KEY_PREFIX}{appid}",
        "title": f"{name}: Free to Keep on Steam"[:200],
        "description": f"Free on Steam{until}: add it to your library while it's free and it stays yours. Free Steam account needed; no payment method.",
        "category": "pure_freebie",
        "merchant": "Steam",
        "url": url,
        "requires_account": True,
        "requires_credit_card": False,
        "instant_cancel_safe": False,
        "trial_duration_days": None,
        "expires_at": ends_at.isoformat() if ends_at else None,
        "is_hero_featured": False,
    }


def fetch_steam_deals() -> list[dict]:
    rows = parse_search(json.loads(fetch(SEARCH_URL))["results_html"])[:MAX_ITEMS]
    deals, skipped = [], 0
    for appid, name, url in rows:
        # Errors propagate: a partial result would wrongly unpublish games.
        details = json.loads(fetch(DETAILS_URL.format(appid=appid))).get(appid, {}).get("data")
        ends_at = None
        if build_deal(appid, name, url, details):
            # Best effort: without the end date the nightly sync still unpublishes it.
            try:
                ends_at = parse_free_until(fetch(PAGE_URL.format(appid=appid)).decode("utf-8", "replace"))
            except Exception as err:
                print(f"  steam: no end date for {name} ({err})")
        if deal := build_deal(appid, name, url, details, ends_at):
            deals.append(deal)
        else:
            skipped += 1
    print(f"  steam: {len(deals)} free-to-keep games ({skipped} DLC/other skipped)")
    return deals
