"""Email digests of new deals for subscribers (alert_subscriptions).

    python -m scrapers.alerts            # send due digests (runs after the nightly scrape)
    python -m scrapers.alerts --dry-run  # print who would get what; sends nothing

Safe to run more than once a night (the workflow can be triggered twice):
a subscriber is only due once per period (last_sent_at), and each Resend
batch carries an Idempotency-Key, so a retried request can't double-send.
Skips quietly when RESEND_API_KEY or ALERTS_SIGNING_SECRET isn't set.
"""

import argparse
import base64
import hashlib
import hmac
import html
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from . import supabase_rest
from .calendar import load_events
from .classify import MERCHANTS

SITE_URL = os.environ.get("ALERTS_SITE_URL", "https://zerocatch.dev").rstrip("/")
FROM = os.environ.get("ALERTS_FROM", "ZeroCatch <alerts@zerocatch.dev>")
RESEND_URL = os.environ.get("RESEND_API_URL", "https://api.resend.com").rstrip("/")
MAX_EMAILS_PER_RUN = 90  # Resend's free tier allows 100/day
MAX_DEALS_PER_EMAIL = 15
PACIFIC = ZoneInfo("America/Los_Angeles")
GAME_PREFIXES = ("epic:", "steam:", "gog:", "itch:")
FOOD_MERCHANTS = set(MERCHANTS)
TOPIC_LABELS = {"games": "Games", "food": "Food", "trials": "Trials", "other": "Other freebies"}


# ── Unsubscribe tokens (verified by src/lib/alert-token.ts) ────────────────


def unsubscribe_token(user_id: str, secret: str) -> str:
    sig = hmac.new(secret.encode(), f"unsubscribe:{user_id}".encode(), hashlib.sha256).digest()
    return f"{user_id}.{base64.urlsafe_b64encode(sig).decode().rstrip('=')}"


# ── Deciding what each subscriber gets ─────────────────────────────────────


def deal_topic(deal: dict, food_ids: set[str], food_calendar_keys: set[str]) -> str:
    key = deal.get("source_key") or ""
    if deal["category"] == "free_trial":
        return "trials"
    if key.startswith(GAME_PREFIXES):
        return "games"
    calendar_key = key.split(":")[1] if key.startswith("calendar:") else None
    if deal["id"] in food_ids or deal["merchant"] in FOOD_MERCHANTS or calendar_key in food_calendar_keys:
        return "food"
    return "other"


def available_since(deal: dict) -> datetime:
    """When the deal became visible: Epic's next games are stored days early."""
    created = datetime.fromisoformat(deal["created_at"])
    starts = datetime.fromisoformat(deal["starts_at"])
    return max(created, starts)


def is_due(sub: dict, now: datetime) -> bool:
    last = datetime.fromisoformat(sub["last_sent_at"]) if sub.get("last_sent_at") else None
    if sub["frequency"] == "weekly":
        return now.astimezone(PACIFIC).weekday() == 0 and (last is None or now - last >= timedelta(days=6))
    return last is None or now - last >= timedelta(hours=20)


def deals_for(
    sub: dict, deals: list[dict], topics: dict[str, str], claimed: set[str], now: datetime,
    hidden_vendors: frozenset[str] | set[str] = frozenset(),
) -> list[dict]:
    window = timedelta(days=7 if sub["frequency"] == "weekly" else 1)
    since = datetime.fromisoformat(sub["last_sent_at"]) if sub.get("last_sent_at") else now - window
    picked = [
        d for d in deals
        if available_since(d) > since and topics[d["id"]] in sub["topics"]
        and d["id"] not in claimed and d["merchant"] not in hidden_vendors
    ]  # fmt: skip
    picked.sort(key=lambda d: (list(TOPIC_LABELS).index(topics[d["id"]]), d.get("expires_at") or "9999"))
    return picked[:MAX_DEALS_PER_EMAIL]


# ── Rendering ──────────────────────────────────────────────────────────────


def _expiry(deal: dict) -> str:
    if not deal.get("expires_at"):
        return "No end date"
    end = datetime.fromisoformat(deal["expires_at"]).astimezone(PACIFIC)
    return f"Ends {end:%b} {end.day}"


def _terms(deal: dict) -> str:
    parts = ["Card required at signup" if deal["requires_credit_card"] else "No credit card"]
    if deal["requires_account"]:
        parts.append("free account needed")
    if deal.get("trial_duration_days"):
        parts.insert(0, f"{deal['trial_duration_days']}-day trial")
    return " · ".join(parts)


def render_email(deals: list[dict], topics: dict[str, str], token: str) -> dict:
    count = len(deals)
    subject = f"{count} new freebie{'s' if count != 1 else ''} on ZeroCatch"
    unsubscribe = f"{SITE_URL}/unsubscribe?token={urllib.parse.quote(token)}"
    rows_html, rows_text = [], []
    for d in deals:
        title, merchant = html.escape(d["title"]), html.escape(d["merchant"])
        meta = html.escape(f"{TOPIC_LABELS[topics[d['id']]]} · {_terms(d)} · {_expiry(d)}")
        rows_html.append(
            f'<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb">'
            f'<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">{merchant}</div>'
            f'<a href="{html.escape(d["url"], quote=True)}" style="font-size:16px;font-weight:600;color:#047857;text-decoration:none">{title}</a>'
            f'<div style="font-size:13px;color:#374151;margin-top:4px">{meta}</div></td></tr>'
        )
        rows_text.append(f"- {d['title']} ({d['merchant']})\n  {_terms(d)} · {_expiry(d)}\n  {d['url']}")
    body_html = f"""<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font-size:20px;font-weight:700;color:#111827">ZeroCatch</td></tr>
<tr><td style="font-size:14px;color:#4b5563;padding:4px 0 8px">{count} new deal{'s' if count != 1 else ''} that passed every rule: no purchase, no paid membership, no hidden catch.</td></tr>
{''.join(rows_html)}
<tr><td style="padding-top:16px"><a href="{SITE_URL}" style="color:#047857;font-weight:600">See everything on ZeroCatch →</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#6b7280">You're getting this because you turned on deal alerts.
<a href="{SITE_URL}/account" style="color:#6b7280">Change topics or frequency</a> ·
<a href="{html.escape(unsubscribe, quote=True)}" style="color:#6b7280">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>"""
    body_text = (
        f"{count} new deal{'s' if count != 1 else ''} on ZeroCatch\n\n" + "\n\n".join(rows_text)
        + f"\n\nSee everything: {SITE_URL}\nChange topics or frequency: {SITE_URL}/account\nUnsubscribe: {unsubscribe}\n"
    )
    return {
        "subject": subject,
        "html": body_html,
        "text": body_text,
        "headers": {
            # One-click unsubscribe (RFC 8058): mail apps POST here.
            "List-Unsubscribe": f"<{SITE_URL}/api/alerts/unsubscribe?token={urllib.parse.quote(token)}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    }


# ── I/O ────────────────────────────────────────────────────────────────────


def send_batch(emails: list[dict], idempotency_key: str) -> None:
    request = urllib.request.Request(
        f"{RESEND_URL}/emails/batch",
        data=json.dumps(emails).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
            "User-Agent": "ZeroCatch-alerts/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Resend {err.code}: {err.read().decode(errors='replace')[:300]}") from None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    secret = os.environ.get("ALERTS_SIGNING_SECRET")
    if not args.dry_run and not (os.environ.get("RESEND_API_KEY") and secret):
        print("alerts: not configured (RESEND_API_KEY / ALERTS_SIGNING_SECRET), skipped")
        return 0
    secret = secret or "dry-run"
    now = datetime.now(timezone.utc)

    subs = supabase_rest.get_rows("alert_subscriptions?select=*&active=eq.true")
    due = [s for s in subs if is_due(s, now)]
    if not due:
        print(f"alerts: {len(subs)} subscribers, none due")
        return 0

    deals = supabase_rest.get_rows(
        "active_deals?select=id,title,merchant,url,category,source_key,starts_at,created_at,expires_at,"
        "requires_account,requires_credit_card,trial_duration_days"
    )
    ids = [d["id"] for d in deals]
    food_ids = {r["deal_id"] for r in supabase_rest.get_in("deal_candidates?select=deal_id&is_food=eq.true", "deal_id", ids)}
    food_keys = {e["key"] for e in load_events() if e.get("food", True)}
    topics = {d["id"]: deal_topic(d, food_ids, food_keys) for d in deals}
    claims: dict[str, set[str]] = {}
    for row in supabase_rest.get_in("deal_claims?select=user_id,deal_id", "user_id", [s["user_id"] for s in due]):
        claims.setdefault(row["user_id"], set()).add(row["deal_id"])
    hidden: dict[str, set[str]] = {}
    for row in supabase_rest.get_in("hidden_vendors?select=user_id,merchant", "user_id", [s["user_id"] for s in due]):
        hidden.setdefault(row["user_id"], set()).add(row["merchant"])

    outgoing: list[tuple[dict, dict]] = []
    for sub in due:
        uid = sub["user_id"]
        picked = deals_for(sub, deals, topics, claims.get(uid, set()), now, hidden.get(uid, set()))
        if picked:
            email = render_email(picked, topics, unsubscribe_token(sub["user_id"], secret))
            outgoing.append((sub, {"from": FROM, "to": [sub["email"]], **email}))
    skipped = max(0, len(outgoing) - MAX_EMAILS_PER_RUN)
    outgoing = outgoing[:MAX_EMAILS_PER_RUN]

    if args.dry_run:
        for sub, email in outgoing:
            print(f"  → {sub['email']}: {email['subject']}")
        print(f"alerts (dry run): {len(outgoing)} of {len(due)} due subscribers have new deals")
        return 0

    sent = 0
    for i in range(0, len(outgoing), 100):
        chunk = outgoing[i : i + 100]
        user_ids = sorted(sub["user_id"] for sub, _ in chunk)
        key = "alerts-" + hashlib.sha256((now.date().isoformat() + ",".join(user_ids)).encode()).hexdigest()[:40]
        send_batch([email for _, email in chunk], key)
        supabase_rest.patch_rows(
            "alert_subscriptions?user_id=in.(" + ",".join(user_ids) + ")", {"last_sent_at": now.isoformat()}
        )
        sent += len(chunk)
    print(f"alerts: sent {sent} digests ({len(due) - len(outgoing) - skipped} due subscribers had nothing new)")
    if skipped:
        print(f"::warning title=Alert cap::{skipped} digests deferred: over the {MAX_EMAILS_PER_RUN}/run cap")
    return 0


if __name__ == "__main__":
    sys.exit(main())
