"""Minimal Supabase (PostgREST) client: just the calls the scrapers need."""

import json
import os
import urllib.error
import urllib.request


class SupabaseError(Exception):
    pass


def _headers(key: str) -> dict[str, str]:
    headers = {"apikey": key, "Content-Type": "application/json"}
    # Legacy service_role keys are JWTs and also go in Authorization. The newer
    # sb_secret_… keys are not JWTs and must only be sent as `apikey`.
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _post(path: str, body: object, prefer: str | None = None) -> object:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = _headers(key)
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(
        f"{url}/rest/v1/{path}", data=json.dumps(body).encode(), method="POST", headers=headers
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read() or b"null")
    except urllib.error.HTTPError as err:
        raise SupabaseError(f"{err.code}: {err.read().decode(errors='replace')}") from err


def insert_new_candidates(rows: list[dict]) -> int:
    """Insert leads, skipping any source_key already queued (so re-runs never
    reset a reviewed candidate back to pending). Returns rows actually added."""
    if not rows:
        return 0
    added = _post(
        "deal_candidates?on_conflict=source_key&select=id",
        rows,
        prefer="resolution=ignore-duplicates,return=representation",
    )
    return len(added or [])


def upsert_deals(rows: list[dict]) -> int:
    """Publish first-party deals, updating any already present (e.g. Epic
    extending an end date). Returns rows written."""
    if not rows:
        return 0
    written = _post(
        "deals?on_conflict=source_key&select=id",
        rows,
        prefer="resolution=merge-duplicates,return=representation",
    )
    return len(written or [])


def run_housekeeping() -> dict:
    return _post("rpc/run_housekeeping", {}) or {}
