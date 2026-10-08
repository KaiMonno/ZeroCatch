"""AI judge: one structured Claude call per new lead decides whether it meets
ZeroCatch's inclusion rules, so blog and press-release leads can publish
without manual review.

Guardrails, so a wrong answer can't invent anything:
- the brand link must be one of the links already found in the article
  (the model returns an index, never a URL)
- deterministic checks re-run on the verdict (dates, categories, card rule)
- only "high" confidence verdicts can publish; everything else is dropped
- AI_JUDGE_MODE=shadow records verdicts without publishing, for evaluation
"""

import json
import os
from datetime import date, datetime, timedelta, timezone

from .dates import day_window

MODEL = "claude-haiku-4-5"
MAX_ARTICLE_CHARS = 20_000  # bounds cost; deal posts are far shorter than this
DEFAULT_LIFETIME_DAYS = 7  # blog deals without a stated end date are short-lived

RULES = """You screen deal posts for ZeroCatch, a site that lists only good-faith freebies.

A post QUALIFIES only if it describes ONE specific offer from ONE brand that is:
- completely free, with no purchase of any kind, and
- available to the general US public on the stated days.

It does NOT qualify if ANY of these apply (use the matching rejection_reason):
- requires_purchase: buy-one-get-one, free with purchase, minimum spend, or any purchase at all.
- points_or_credit: the "free" thing is points, store credit, bonus cash, or a gift card.
- free_shipping: the only free part is shipping, delivery, or returns.
- paid_membership: requires a PAID membership or subscription (Amazon Prime, Target Circle 360,
  Walmart+, carrier perks like Verizon/T-Mobile, Costco, Sam's Club, DashPass, streaming services).
  Free loyalty programs and free apps are fine.
- rebate: you must pay first and get money back (rebates, cash back, store cash, "better than free").
- limited_quantity: only the first N customers, while supplies last as the main condition, or will sell out.
- in_store_event: a workshop, class, party, photo session, or timed event rather than a product freebie.
- audience_only: only for teachers, students, military, nurses, kids, seniors, or another group.
- contest: a sweepstakes, giveaway drawing, or chance to win.
- roundup: a list of many deals rather than one offer.
- not_free: a discount, sale, or price cut, not something free.
- expired: the offer has already ended relative to the post's publish date.
- unclear: you cannot tell what the offer or its terms are.

Write title and description in your own words (never copy sentences). The description must
state the exact terms: what is free and any account or app needed.
Pick brand_link_index from the numbered links: the brand's OWN page for the offer. Use -1 if
none of them is the brand's own page. Use confidence "high" only when the post states the
terms plainly. Dates: starts_on/ends_on are the offer's US calendar days (YYYY-MM-DD), or ""
if not stated."""

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "qualifies": {"type": "boolean"},
        "rejection_reason": {
            "type": "string",
            "enum": ["none", "requires_purchase", "points_or_credit", "free_shipping", "paid_membership", "rebate", "limited_quantity", "in_store_event",
                     "audience_only", "contest", "roundup", "not_free", "expired", "unclear"],
        },
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "is_food": {"type": "boolean"},
        "merchant": {"type": "string"},
        "title": {"type": "string"},
        "description": {"type": "string"},
        "brand_link_index": {"type": "integer"},
        "requires_account": {"type": "boolean"},
        "requires_credit_card": {"type": "boolean"},
        "starts_on": {"type": "string"},
        "ends_on": {"type": "string"},
    },
    "required": ["qualifies", "rejection_reason", "confidence", "is_food", "merchant", "title",
                 "description", "brand_link_index", "requires_account", "requires_credit_card",
                 "starts_on", "ends_on"],
    "additionalProperties": False,
}  # fmt: skip


def judge_mode() -> str:
    """off | shadow | publish. Off without an API key, so the pipeline still runs."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return "off"
    mode = os.environ.get("AI_JUDGE_MODE", "shadow").strip().lower()
    return mode if mode in ("off", "shadow", "publish") else "shadow"


def build_prompt(lead: dict, article_text: str, links: list[tuple[str, str]]) -> str:
    numbered = "\n".join(f"[{i}] {url}  ({anchor or 'no anchor text'})" for i, (url, anchor) in enumerate(links))
    return (
        f"Post published: {lead.get('published_at') or 'unknown'}\n"
        f"Post title: {lead['title']}\n\n"
        f"Links found in the post:\n{numbered or '(none)'}\n\n"
        f"Post text:\n{article_text[:MAX_ARTICLE_CHARS]}"
    )


def call_judge(prompt: str) -> dict:
    import anthropic  # imported lazily: only needed when the judge is on

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=RULES,
        messages=[{"role": "user", "content": prompt}],
        output_config={"format": {"type": "json_schema", "schema": VERDICT_SCHEMA}},
    )
    if response.stop_reason == "refusal":
        return {"qualifies": False, "rejection_reason": "unclear", "confidence": "low", "_refusal": True}
    text = next(block.text for block in response.content if block.type == "text")
    return json.loads(text)


def _parse_day(value: str) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def verdict_to_deal(verdict: dict, links: list[tuple[str, str]], now: datetime) -> tuple[dict | None, str]:
    """Deterministic checks on the model's verdict. Returns (deal, "") to
    publish, or (None, reason) when it must not be published."""
    if not verdict.get("qualifies"):
        return None, f"ai: {verdict.get('rejection_reason', 'unclear')}"
    if verdict.get("confidence") != "high":
        return None, f"ai: confidence {verdict.get('confidence')}"
    index = verdict.get("brand_link_index", -1)
    if not isinstance(index, int) or not 0 <= index < len(links):
        return None, "ai: no brand link"
    if verdict.get("requires_credit_card"):
        return None, "ai: card required on a freebie"
    if not verdict.get("title", "").strip() or not verdict.get("merchant", "").strip():
        return None, "ai: missing title or merchant"

    start_day, end_day = _parse_day(verdict.get("starts_on", "")), _parse_day(verdict.get("ends_on", ""))
    starts_at = day_window(start_day)[0] if start_day else now
    expires_at = day_window(end_day or start_day)[1] if (end_day or start_day) else now + timedelta(days=DEFAULT_LIFETIME_DAYS)
    if expires_at <= now:
        return None, "ai: already ended"
    if expires_at <= starts_at:
        return None, "ai: ends before it starts"

    return {
        "title": verdict["title"].strip()[:200],
        "description": verdict["description"].strip(),
        "category": "pure_freebie",
        "merchant": verdict["merchant"].strip(),
        "url": links[index][0],
        "requires_account": bool(verdict.get("requires_account")),
        "requires_credit_card": bool(verdict.get("requires_credit_card")),
        "instant_cancel_safe": False,
        "trial_duration_days": None,
        "starts_at": starts_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_hero_featured": False,
    }, ""


def _now() -> datetime:
    """The current time; a separate function so tests can freeze the clock."""
    return datetime.now(timezone.utc)


def judge_lead(lead: dict, article_text: str, links: list[tuple[str, str]]) -> tuple[dict, dict | None, str]:
    """(verdict, deal-or-None, reason). Network/API errors propagate to the caller."""
    verdict = call_judge(build_prompt(lead, article_text, links))
    deal, reason = verdict_to_deal(verdict, links, _now())
    return verdict, deal, reason
