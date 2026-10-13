"""RSS feeds the blog scraper reads. Every entry must permit automated access in its
robots.txt (checked at runtime in fetch.py). Blogs and forums are lead sources
only: a human verifies each lead and links the brand's own page, never the blog.

Sources ruled out (2026-10):
- Slickdeals forums: Terms of Service (Mar 2026) prohibit any automated access
  without written permission, even where robots.txt allows the page.
- GamerPower API: robots.txt disallows /api/* despite its API docs.
- Hey It's Free, Mojo Savings, Penny Pinchin' Mom: robots.txt blocks the feeds.
- Business Wire and GlobeNewswire RSS: robots.txt disallows their feeds for bots.
- Slickdeals Freebies RSS: robots.txt disallows /newsearch.php?*rss=* for all bots.
- The Freebie Guy: feeds return 403 to non-browser clients.
- Reddit: robots.txt blocks all crawlers; the API needs approval and bans commercial use.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    name: str  # becomes the `source` column and the source_key prefix
    url: str
    # Posts in these feed categories are kept even without a "free" keyword.
    trusted_categories: frozenset[str] = frozenset()


RSS_SOURCES: list[Source] = [
    # Hip2Save is paused (2026-10): ~1% of its posts meet the inclusion rules and
    # most survivors lack a clean brand link. Re-enable by uncommenting.
    # Source(
    #     name="hip2save",
    #     url="https://hip2save.com/category/freebies/feed/",
    #     trusted_categories=frozenset({"Legit Freebies & Samples"}),
    # ),
    # Source(name="hip2save", url="https://hip2save.com/feed/"),
    #
    # Freebie blogs whose robots.txt and terms permit automated reading
    # (checked 2026-10-13). Leads only: the AI judge verifies each one, and the
    # published deal links the brand's own page, never the blog.
    Source(name="icravefreebies", url="https://www.icravefreebies.com/feed/"),
    Source(name="moneysavingmom", url="https://www.moneysavingmom.com/category/freebies/feed/"),
    #
    # First-party announcements: brands post national freebies here. Rare
    # (a few a month) but exact, dated, and linking to the brand. The two
    # food-beverages URLs serve the same feed, so only one is listed.
    Source(name="prnewswire", url="https://www.prnewswire.com/rss/consumer-products-retail-latest-news/restaurants-list.rss"),
    Source(name="prnewswire", url="https://www.prnewswire.com/rss/food-beverages-latest-news/food-beverages-latest-news-list.rss"),
]
