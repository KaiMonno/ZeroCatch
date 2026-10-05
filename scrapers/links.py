"""Pick the brand's own link out of a blog article.

ZeroCatch never links to the blog itself or to affiliate redirects, so a lead
without a clean brand link isn't publishable and gets rejected.
"""

import html
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Affiliate networks, link shorteners and redirectors.
AFFILIATE_HOSTS = (
    "ltk.com", "liketoknow.it", "amzn.to", "trx-hub.com", "awin1.com", "shareasale.com", "linksynergy.com",
    "rakuten.com", "skimresources.com", "redirectingat.com", "sjv.io", "pxf.io", "anrdoezrs.net",
    "dpbolvw.net", "jdoqocy.com", "tkqlhce.com", "kqzyfj.com", "howl.me", "shop-links.co", "bit.ly",
    "impact.com", "avantlink.com", "pepperjam.com", "narrativ.com", "go.magik.ly", "tidd.ly", "shoplowes.me",
)  # fmt: skip
NON_BRAND_HOSTS = (
    "tiktok.com", "instagram.com", "facebook.com", "twitter.com", "x.com", "youtube.com", "pinterest.com",
    "threads.net", "reddit.com", "apple.com/app", "play.google.com",
    # Press wires restate the brand's announcement; the brand's own page is better.
    "prnewswire.com", "businesswire.com", "globenewswire.com",
)  # fmt: skip
_AFFILIATE_PARAMS = {"tag", "ascsubtag", "linkcode", "linkid", "aff", "affid", "affiliate", "ref", "irclickid", "clickid"}
_ANCHOR_RE = re.compile(r'<a\s[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', re.S | re.I)
_ARTICLE_RE = re.compile(r"<article\b.*?</article>", re.S | re.I)


def _host_matches(host: str, domains: tuple[str, ...]) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def _clean(url: str) -> str:
    parts = urlsplit(html.unescape(url))
    query = [(k, v) for k, v in parse_qsl(parts.query) if not k.lower().startswith("utm_")]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def _article_body(page: str) -> str:
    return m.group(0) if (m := _ARTICLE_RE.search(page)) else page


def brand_links(page: str, blog_host: str) -> list[tuple[str, str, str]]:
    """(host, clean url, anchor text) for every non-affiliate, non-social https link
    in the article, in order, de-duplicated."""
    seen, links = set(), []
    for href, text in _ANCHOR_RE.findall(_article_body(page)):
        parts = urlsplit(html.unescape(href))
        host = parts.netloc.lower().removeprefix("www.")
        if not host or parts.scheme != "https" or _host_matches(host, (blog_host,)):
            continue
        if _host_matches(host, AFFILIATE_HOSTS) or any(host == d.split("/")[0] for d in NON_BRAND_HOSTS):
            continue
        if any(k.lower() in _AFFILIATE_PARAMS for k, _ in parse_qsl(parts.query)):
            continue
        url = _clean(href)
        if url in seen:
            continue
        seen.add(url)
        links.append((host, url, html.unescape(re.sub(r"<[^>]+>", "", text)).strip()))
    return links


def pick_brand_link(page: str, blog_host: str, merchant_domain: str | None) -> tuple[str, str] | None:
    """(clean url, anchor text) of the best brand link in the article, or None."""
    candidates = brand_links(page, blog_host)
    if not candidates:
        return None
    if merchant_domain:
        for host, url, anchor in candidates:
            if _host_matches(host, (merchant_domain,)):
                return url, anchor
    _, url, anchor = candidates[0]
    return url, anchor


_SCRIPT_RE = re.compile(r"<(script|style|noscript|svg)\b.*?</\1>", re.S | re.I)


def article_text(page: str) -> str:
    """Readable text of the article body, for the AI judge."""
    body = _SCRIPT_RE.sub(" ", _article_body(page))
    body = re.sub(r"<(br|/p|/li|/h\d)\b[^>]*>", "\n", body, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", body))
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()
