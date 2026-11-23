"""One email to the admin when the nightly run queues leads for review.

Calendar leads come first: they have a date, and if nobody confirms them in
time the freebie is missed (2026's Veterans Day lead sat unseen until it
expired). At most one email a night, and only when something new is waiting.
Skips quietly unless RESEND_API_KEY and REVIEW_NOTIFY_EMAIL are set.
"""

import hashlib
import html
import json
import os
import urllib.error
import urllib.request
from datetime import datetime

from .alerts import FROM, RESEND_URL, SITE_URL
from .dates import PACIFIC

REVIEW_URL = f"{SITE_URL}/admin/review"


def _day(iso: str | None) -> str | None:
    if not iso:
        return None
    local = datetime.fromisoformat(iso).astimezone(PACIFIC)
    return f"{local:%a %b} {local.day}"


def render_notice(leads: list[dict]) -> dict:
    """Subject and bodies for the leads just queued (calendar leads first, soonest first)."""
    dated = sorted((l for l in leads if l.get("source") == "calendar"), key=lambda l: l.get("suggested_starts_at") or "")
    others = [l for l in leads if l.get("source") != "calendar"]
    count = len(leads)
    subject = (
        f"Confirm by {_day(dated[0]['suggested_starts_at'])}: {dated[0]['title']}"
        + (f" (+{count - 1} more)" if count > 1 else "")
        if dated
        else f"{count} new lead{'s' if count != 1 else ''} to review on ZeroCatch"
    )
    rows_html, rows_text = [], []
    for lead in [*dated, *others]:
        when = _day(lead.get("suggested_starts_at")) if lead.get("source") == "calendar" else None
        tag = f"Calendar · confirm before {when}" if when else (lead.get("source") or "lead").capitalize()
        title, url = lead["title"], lead.get("source_url") or REVIEW_URL
        rows_html.append(
            '<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb">'
            f'<div style="font-size:12px;color:{"#b45309" if when else "#6b7280"};text-transform:uppercase;letter-spacing:.04em">{html.escape(tag)}</div>'
            f'<a href="{html.escape(url, quote=True)}" style="font-size:15px;font-weight:600;color:#111827;text-decoration:none">{html.escape(title)}</a></td></tr>'
        )
        rows_text.append(f"- [{tag}] {title}\n  {url}")
    body_html = f"""<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font-size:18px;font-weight:700;color:#111827">Waiting for review</td></tr>
<tr><td style="font-size:14px;color:#4b5563;padding:4px 0 8px">Tonight's run queued {count} lead{'s' if count != 1 else ''}. Nothing goes live until you approve it.</td></tr>
{''.join(rows_html)}
<tr><td style="padding-top:16px"><a href="{REVIEW_URL}" style="color:#047857;font-weight:600">Open the review queue →</a></td></tr>
</table></td></tr></table></body></html>"""
    body_text = f"Tonight's run queued {count} lead{'s' if count != 1 else ''}:\n\n" + "\n\n".join(rows_text) + f"\n\nReview: {REVIEW_URL}\n"
    return {"subject": subject, "html": body_html, "text": body_text}


def notify(leads: list[dict]) -> str:
    """Send the notice; returns a line for the log. Errors propagate to the caller."""
    to = os.environ.get("REVIEW_NOTIFY_EMAIL", "").strip()
    if not leads:
        return "no new leads waiting"
    if not (to and os.environ.get("RESEND_API_KEY")):
        return "not configured (RESEND_API_KEY / REVIEW_NOTIFY_EMAIL), skipped"
    # A rerun of the same night queues nothing new, but the key also guards a retried request.
    key = hashlib.sha256("\n".join(sorted(l["source_key"] for l in leads)).encode()).hexdigest()[:32]
    request = urllib.request.Request(
        f"{RESEND_URL}/emails",
        data=json.dumps({"from": FROM, "to": [to], **render_notice(leads)}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"review-{key}",
            "User-Agent": "ZeroCatch-alerts/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Resend {err.code}: {err.read().decode(errors='replace')[:300]}") from None
    return f"emailed ({len(leads)} lead{'s' if len(leads) != 1 else ''})"
