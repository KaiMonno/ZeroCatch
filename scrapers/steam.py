"""Steam free-to-keep promotions → published deals.

Steam's search for "free + on special" finds 100%-off items. DLC is excluded:
it only works with a base game you'd have to buy. Only items Steam's own API
confirms as full games are published. Steam doesn't expose the promo end date,
so the nightly sync unpublishes a game as soon as it drops out of the search.
"""

import json
import re
from html import unescape

from .fetch import fetch

SEARCH_URL = (
    "https://store.steampowered.com/search/results/"
    "?maxprice=free&specials=1&infinite=1&cc=us&l=english&count=50"
)
DETAILS_URL = "https://store.steampowered.com/api/appdetails?appids={appid}&cc=us&l=english"
_ROW_RE = re.compile(
    r'<a href="(https://store\.steampowered\.com/app/(\d+)/[^"?]*)[^"]*".*?<span class="title">([^<]+)</span>',
    re.S,
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


def build_deal(appid: str, name: str, url: str, details: dict | None) -> dict | None:
    """A publishable deal, or None for DLC, soundtracks, or anything unverified."""
    if not details or details.get("type") != "game":
        return None
    return {
        "source_key": f"{KEY_PREFIX}{appid}",
        "title": f"{name}: Free to Keep on Steam"[:200],
        "description": "Limited-time Steam promotion: add it to your library while it's free and it stays yours. Free Steam account needed; no payment method.",
        "category": "pure_freebie",
        "merchant": "Steam",
        "url": url,
        "requires_account": True,
        "requires_credit_card": False,
        "instant_cancel_safe": False,
        "trial_duration_days": None,
        "expires_at": None,
        "is_hero_featured": False,
    }


def fetch_steam_deals() -> list[dict]:
    rows = parse_search(json.loads(fetch(SEARCH_URL))["results_html"])[:MAX_ITEMS]
    deals, skipped = [], 0
    for appid, name, url in rows:
        # Errors propagate: a partial result would wrongly unpublish games.
        details = json.loads(fetch(DETAILS_URL.format(appid=appid))).get(appid, {}).get("data")
        if deal := build_deal(appid, name, url, details):
            deals.append(deal)
        else:
            skipped += 1
    print(f"  steam: {len(deals)} free-to-keep games ({skipped} DLC/other skipped)")
    return deals
