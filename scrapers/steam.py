"""Steam free-to-keep promotions → review-queue leads.

Steam's search for "free + on special" finds 100%-off items, but many are DLC
that only work with a paid base game: a catch a human must judge. Steam also
doesn't expose the promo end date via API, so a reviewer adds it.
"""

import json
import re
from datetime import datetime, timezone
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


def parse_search(results_html: str) -> list[tuple[str, str, str]]:
    """(appid, name, url) for each app row. Packages/bundles are skipped."""
    seen, rows = set(), []
    for url, appid, name in _ROW_RE.findall(results_html):
        if appid not in seen:
            seen.add(appid)
            rows.append((appid, unescape(name).strip(), url))
    return rows


def build_lead(appid: str, name: str, url: str, details: dict | None) -> dict:
    is_dlc = bool(details and details.get("type") == "dlc")
    base_game = ((details or {}).get("fullgame") or {}).get("name")
    blurb = unescape((details or {}).get("short_description") or "").strip()
    summary = f"DLC: requires {base_game or 'the base game'}. Check whether the base game is free. " if is_dlc else ""
    summary += blurb[:300]
    return {
        "source": "steam",
        # One lead per app: if the same app goes free again later, add it by hand.
        "source_key": f"steam:{appid}",
        "title": f"Free to keep on Steam: {name}"[:200],
        "summary": summary + " Promo end date isn't in Steam's API, so check the store page.",
        "source_url": url,
        "source_categories": ["DLC" if is_dlc else "Game"],
        "published_at": datetime.now(timezone.utc).isoformat(),  # no post date; use first seen
        "is_food": False,
        # DLC that needs a paid game is effectively "free with purchase".
        "suggested_category": "free_with_purchase" if is_dlc else "pure_freebie",
        "suggested_merchant": "Steam",
    }


def fetch_steam_leads() -> list[dict]:
    rows = parse_search(json.loads(fetch(SEARCH_URL))["results_html"])[:MAX_ITEMS]
    leads = []
    for appid, name, url in rows:
        try:
            details = json.loads(fetch(DETAILS_URL.format(appid=appid))).get(appid, {}).get("data")
        except Exception as err:  # details are a nice-to-have; still queue the lead
            print(f"  steam: appdetails failed for {appid}: {err}")
            details = None
        leads.append(build_lead(appid, name, url, details))
    print(f"  steam: {len(leads)} free-to-keep items")
    return leads
