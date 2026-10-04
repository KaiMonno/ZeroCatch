"""Feeds the pipeline reads. Every entry must permit automated access in its
robots.txt (checked at runtime in fetch.py). Blogs and forums are lead sources
only: a human verifies each lead and links the brand's own page, never the blog.

Sources ruled out (2026-10):
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


SOURCES: list[Source] = [
    Source(
        name="hip2save",
        url="https://hip2save.com/category/freebies/feed/",
        trusted_categories=frozenset({"Legit Freebies & Samples"}),
    ),
    # The main feed carries restaurant posts that the freebies category misses.
    # Overlap is harmless: both feeds share post IDs, so source_key dedupes.
    Source(name="hip2save", url="https://hip2save.com/feed/"),
]
