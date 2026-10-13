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
    "mavely.app.link", "app.link", "fave.co", "trackcm.com", "click.linksynergy.com", "rstyle.me", "shopstyle.it",
    "go.skimresources.com", "prf.hn", "pntrs.com", "pntra.com", "dpdsj.com", "a.co", "goto.target.com",
    "goto.walmart.com", "fetch.com", "ibotta.com",
)  # fmt: skip
NON_BRAND_HOSTS = (
    "tiktok.com", "instagram.com", "facebook.com", "twitter.com", "x.com", "youtube.com", "pinterest.com",
    "threads.net", "reddit.com", "apple.com/app", "play.google.com",
    # Share buttons and community channels, not brands.
    "addtoany.com", "sharethis.com", "t.me", "telegram.me", "telegram.org", "whatsapp.com", "wa.me",
    "linkedin.com", "tumblr.com", "flipboard.com", "pinterest.co", "x.co", "bsky.app",
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


_LETTERS_RE = re.compile(r"[^a-z0-9]")


def _brand_label(host: str) -> str:
    """'www.coca-cola.com' → 'cocacola'; 'shop.stetson.com' → 'stetson'."""
    labels = host.lower().removeprefix("www.").split(".")
    core = labels[-2] if len(labels) >= 2 else labels[0]
    return _LETTERS_RE.sub("", core)


def host_matches_title(host: str, title: str) -> bool:
    """True when the link's domain names something in the title: the guard that
    keeps ads, trackers and social profiles from passing as "the brand's page".
    Neutrogena → neutrogena.com, Coca Cola → coca-cola.com, EWTN → ewtnmission.com."""
    label = _brand_label(host)
    if len(label) < 3:
        return False
    squashed = _LETTERS_RE.sub("", title.lower())
    if label in squashed:
        return True
    words = {_LETTERS_RE.sub("", w) for w in title.lower().split()}
    return any(len(w) >= 4 and w in label for w in words)


def pick_brand_link(
    page: str, blog_host: str, merchant_domain: str | None, title: str | None = None
) -> tuple[str, str] | None:
    """(clean url, anchor text) of the brand's own link in the article, or None.

    With a known merchant, its domain wins. Otherwise, when a title is given,
    only a link whose domain matches the title counts (strict mode); without a
    title, the first clean link is used.
    """
    candidates = brand_links(page, blog_host)
    if not candidates:
        return None
    if merchant_domain:
        for host, url, anchor in candidates:
            if _host_matches(host, (merchant_domain,)):
                return url, anchor
    if title is not None:
        return next(((url, anchor) for host, url, anchor in candidates if host_matches_title(host, title)), None)
    _, url, anchor = candidates[0]
    return url, anchor


_SCRIPT_RE = re.compile(r"<(script|style|noscript|svg)\b.*?</\1>", re.S | re.I)


def article_text(page: str) -> str:
    """Readable text of the article body, for the AI judge."""
    body = _SCRIPT_RE.sub(" ", _article_body(page))
    body = re.sub(r"<(br|/p|/li|/h\d)\b[^>]*>", "\n", body, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", body))
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()
