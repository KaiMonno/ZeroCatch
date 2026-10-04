"""Parse RSS 2.0 into plain FeedItems. Stdlib only."""

import hashlib
import html
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qs, urlsplit

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


@dataclass
class FeedItem:
    guid: str
    title: str
    link: str
    summary: str
    categories: list[str] = field(default_factory=list)
    published_at: datetime | None = None

    @property
    def stable_id(self) -> str:
        """WordPress post ID when available (shared across a site's feeds), else a hash."""
        post_id = parse_qs(urlsplit(self.guid).query).get("p")
        if post_id:
            return post_id[0]
        return hashlib.sha1((self.guid or self.link).encode()).hexdigest()[:16]


def clean_text(raw: str | None, limit: int | None = None) -> str:
    text = _WS_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", raw or ""))).strip()
    if limit and len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def parse_rss(xml_bytes: bytes) -> list[FeedItem]:
    root = ET.fromstring(xml_bytes)
    items = []
    for node in root.iterfind("./channel/item"):
        pub = node.findtext("pubDate")
        try:
            published = parsedate_to_datetime(pub) if pub else None
        except (TypeError, ValueError):
            published = None
        items.append(
            FeedItem(
                guid=(node.findtext("guid") or "").strip(),
                title=clean_text(node.findtext("title")),
                link=(node.findtext("link") or "").strip(),
                summary=clean_text(node.findtext("description"), limit=400),
                categories=[clean_text(c.text) for c in node.iterfind("category") if c.text],
                published_at=published,
            )
        )
    return items
