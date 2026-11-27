"""RSS feeds the blog scraper reads. Every entry must permit automated access in its
robots.txt (checked at runtime in fetch.py). Blogs are lead sources only: the
inclusion rules and the AI judge vet each lead, and a published deal links the
brand's own page, never the blog.

Sources ruled out (2026-10):
- Slickdeals forums: Terms of Service (Mar 2026) prohibit any automated access
  without written permission, even where robots.txt allows the page.
- GamerPower API: robots.txt disallows /api/* despite its API docs.
- Hey It's Free, Mojo Savings, Penny Pinchin' Mom: robots.txt blocks the feeds.
- Business Wire and GlobeNewswire RSS: robots.txt disallows their feeds for bots.
- Slickdeals Freebies RSS: robots.txt disallows /newsearch.php?*rss=* for all bots.
- The Freebie Guy: allowed, but nearly every post is a roundup (re-checked 2026-10-27).
- IsThereAnyDeal API: deal links are its own redirects and giveaway links are
  affiliate-tracked; its terms forbid altering the data and competing apps.
- Reddit: robots.txt blocks all crawlers; the API needs approval and bans commercial use.

Removed:
- I Crave Freebies (2026-11-19): no new posts since Aug 27, and its feed
  sometimes serves malformed XML.
- PR Newswire restaurant and food feeds (2026-11-27): 0 leads in six weeks.
  Each feed holds only the latest 20 releases, none of them freebies; the
  brand freebies it was meant to catch all reached the blogs first.
- Instagram brand accounts (code removed 2026-11-27, off since 2026-10-27):
  0 leads in two weeks of brand posts. It's in git history if needed.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    name: str  # becomes the `source` column and the source_key prefix
    url: str
    # Posts in these feed categories are kept even without a "free" keyword.
    trusted_categories: frozenset[str] = frozenset()


RSS_SOURCES: list[Source] = [
    # Hip2Save: freebies category only (re-enabled 2026-10-28). Paused earlier
    # when every lead needed a human check; the AI judge now rejects its many
    # "free with purchase" posts. The main feed (~1% freebies) stays off.
    Source(
        name="hip2save",
        url="https://hip2save.com/category/freebies/feed/",
        trusted_categories=frozenset({"Legit Freebies & Samples"}),
    ),
    #
    # Freebie blogs whose robots.txt and terms permit automated reading
    # (checked 2026-10-13). Leads only: the AI judge verifies each one, and the
    # published deal links the brand's own page, never the blog.
    Source(name="moneysavingmom", url="https://www.moneysavingmom.com/category/freebies/feed/"),
    # Added 2026-10-27: robots.txt allows the feeds and articles, and neither site
    # has terms restricting automated access. A dry run of the rules over one
    # week gave ~4 leads (Free Stuff Finder's freebies category; its main feed
    # is mostly coupons) and ~2 (Freebie Shark, which has no category feed).
    Source(name="freestufffinder", url="https://www.freestufffinder.com/category/freebies/feed/"),
    Source(name="freebieshark", url="https://freebieshark.com/feed/"),
]
