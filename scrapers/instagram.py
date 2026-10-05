"""Instagram brand accounts → review-queue leads (Meta Graph API).

Uses "business discovery": your own Instagram professional account reads the
public posts of other Business/Creator accounts. Requires two secrets:
INSTAGRAM_ACCESS_TOKEN (long-lived user token, renew every ~60 days) and
INSTAGRAM_USER_ID (your Instagram professional account's ID). Without them the
source is skipped.

    python -m scrapers.instagram --check   # per-brand report, writes nothing
"""

import argparse
import json
import os
import re
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .classify import classify
from .dates import day_window, find_deal_day

BRANDS_FILE = Path(__file__).parent / "data" / "instagram_brands.toml"
GRAPH_URL = "https://graph.facebook.com/{version}/{user_id}"
GRAPH_VERSION = os.environ.get("INSTAGRAM_GRAPH_VERSION", "v25.0")
POSTS_PER_BRAND = 10
_FIRST_LINE_RE = re.compile(r"^(.+?)(?:\n|(?<=[.!?])\s|$)", re.S)


class InstagramError(Exception):
    pass


def configured() -> bool:
    return bool(os.environ.get("INSTAGRAM_ACCESS_TOKEN") and os.environ.get("INSTAGRAM_USER_ID"))


def load_brands(path: Path = BRANDS_FILE) -> list[dict]:
    return tomllib.loads(path.read_text())["brand"]


def fetch_brand_posts(handle: str) -> list[dict]:
    fields = f"business_discovery.username({handle}){{username,media.limit({POSTS_PER_BRAND}){{caption,permalink,timestamp,media_type}}}}"
    query = urllib.parse.urlencode({"fields": fields, "access_token": os.environ["INSTAGRAM_ACCESS_TOKEN"]})
    url = GRAPH_URL.format(version=GRAPH_VERSION, user_id=os.environ["INSTAGRAM_USER_ID"]) + "?" + query
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as err:
        # Report Meta's message, never the URL (it contains the token).
        try:
            message = json.loads(err.read()).get("error", {}).get("message", "")
        except ValueError:
            message = ""
        raise InstagramError(f"{err.code} {message}".strip()) from None
    return ((payload.get("business_discovery") or {}).get("media") or {}).get("data") or []


def post_to_lead(post: dict, brand: dict, now: datetime, max_age_days: int) -> tuple[dict | None, str]:
    """(lead, "") or (None, reason) for one Instagram post."""
    caption = (post.get("caption") or "").strip()
    if not caption:
        return None, "no_caption"
    published = datetime.fromisoformat(post["timestamp"].replace("+0000", "+00:00"))
    if published < now - timedelta(days=max_age_days):
        return None, "old_post"
    first_line = _FIRST_LINE_RE.match(caption).group(1).strip()[:200]

    c = classify(first_line, caption, [], frozenset())
    if not c.keep:
        # Captions often lead with a hook; check the whole caption for "free".
        c = classify(caption[:300], caption, [], frozenset())
        if not c.keep:
            return None, c.reject_reason or "not_free"

    day = find_deal_day(caption, published)
    starts_at = expires_at = None
    if day:
        start, end = day_window(day)
        if end < now:
            return None, "past_date"
        expires_at = end.isoformat()
        if start > now:
            starts_at = start.isoformat()

    return {
        "source": "instagram",
        "source_key": f"instagram:{post['id']}",
        "title": f"{brand['merchant']}: {first_line}"[:200],
        "summary": caption[:400],
        "source_url": post["permalink"],
        "source_categories": ["Instagram"],
        "published_at": published.isoformat(),
        "is_food": True,
        "suggested_category": "pure_freebie",
        "suggested_merchant": brand["merchant"],
        "suggested_url": brand["url"],
        "suggested_starts_at": starts_at,
        "suggested_expires_at": expires_at,
        # Context for the AI judge when it's on; never stored.
        "_article_text": caption,
        "_links": [(brand["url"], brand["merchant"])],
    }, ""


def fetch_instagram_leads(max_age_days: int = 7, report: list | None = None) -> list[dict]:
    if not configured():
        print("  instagram: not configured (no INSTAGRAM_* secrets), skipped")
        return []
    now = datetime.now(timezone.utc)
    leads, failed = [], []
    for brand in load_brands():
        try:
            posts = fetch_brand_posts(brand["handle"])
        except (InstagramError, urllib.error.URLError) as err:
            failed.append(f"@{brand['handle']}: {err}")
            if report is not None:
                report.append((brand["handle"], f"ERROR {err}", []))
            continue
        outcomes = []
        for post in posts:
            lead, reason = post_to_lead(post, brand, now, max_age_days)
            outcomes.append((reason or "LEAD", (post.get("caption") or "")[:90].replace("\n", " ")))
            if lead:
                leads.append(lead)
        if report is not None:
            report.append((brand["handle"], f"{len(posts)} posts", outcomes))
    print(f"  instagram: {len(leads)} leads from {len(load_brands()) - len(failed)} brands ({len(failed)} failed)")
    if failed and len(failed) == len(load_brands()):
        raise InstagramError("every brand failed; first error: " + failed[0])
    for line in failed:
        print(f"    {line}")
    return leads


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="print a per-brand report; writes nothing")
    parser.add_argument("--max-age-days", type=int, default=30, help="for --check: how far back to look (default 30)")
    args = parser.parse_args()
    report: list = []
    leads = fetch_instagram_leads(args.max_age_days, report)
    for handle, status, outcomes in report:
        print(f"\n@{handle}: {status}")
        for reason, caption in outcomes:
            print(f"   {'★' if reason == 'LEAD' else ' '} {reason:<16} {caption}")
    print(f"\n{len(leads)} leads would be queued")


if __name__ == "__main__":
    main()
