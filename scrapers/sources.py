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
    # I Crave Freebies now posts only every few weeks; harmless to keep.
    Source(name="icravefreebies", url="https://www.icravefreebies.com/feed/"),
    Source(name="moneysavingmom", url="https://www.moneysavingmom.com/category/freebies/feed/"),
    # Added 2026-10-27: robots.txt allows the feeds and articles, and neither site
    # has terms restricting automated access. A dry run of the rules over one
    # week gave ~4 leads (Free Stuff Finder's freebies category; its main feed
    # is mostly coupons) and ~2 (Freebie Shark, which has no category feed).
    Source(name="freestufffinder", url="https://www.freestufffinder.com/category/freebies/feed/"),
    Source(name="freebieshark", url="https://freebieshark.com/feed/"),
    #
    # First-party announcements: brands post national freebies here. Rare
    # (a few a month) but exact, dated, and linking to the brand. The two
    # food-beverages URLs serve the same feed, so only one is listed.
    Source(name="prnewswire", url="https://www.prnewswire.com/rss/consumer-products-retail-latest-news/restaurants-list.rss"),
    Source(name="prnewswire", url="https://www.prnewswire.com/rss/food-beverages-latest-news/food-beverages-latest-news-list.rss"),
]
