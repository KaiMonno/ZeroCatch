"""Minimal Supabase (PostgREST) client: just the calls the scrapers need."""

import json
import os
from datetime import datetime, timezone
import urllib.error
import urllib.parse
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


def _uniform(rows: list[dict]) -> list[dict]:
    """PostgREST bulk inserts need identical keys in every row. Keys starting
    with "_" are in-memory context (e.g. article text) and are never stored."""
    keys = {k for row in rows for k in row if not k.startswith("_")}
    return [{k: row.get(k) for k in keys} for row in rows]


def _get(path: str) -> object:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    request = urllib.request.Request(f"{url}/rest/v1/{path}", headers=_headers(os.environ["SUPABASE_SERVICE_ROLE_KEY"]))
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read() or b"null")
    except urllib.error.HTTPError as err:
        raise SupabaseError(f"{err.code}: {err.read().decode(errors='replace')}") from err


def existing_candidate_keys(keys: list[str]) -> set[str]:
    """source_keys already in the queue, so the AI judge never re-judges a post."""
    found: set[str] = set()
    for i in range(0, len(keys), 50):  # keep URLs short
        listed = urllib.parse.quote(",".join(f'"{k}"' for k in keys[i : i + 50]))
        rows = _get(f"deal_candidates?select=source_key&source_key=in.({listed})") or []
        found.update(row["source_key"] for row in rows)
    return found


def live_deal_urls() -> set[str]:
    """Links of deals that are live or scheduled, to avoid publishing duplicates."""
    now = urllib.parse.quote(datetime.now(timezone.utc).isoformat())
    rows = _get(f"deals?select=url&or=(expires_at.is.null,expires_at.gt.{now})") or []
    return {row["url"] for row in rows}


def approve_candidate(candidate_id: str, deal: dict) -> str:
    return _post("rpc/approve_candidate", {"p_candidate_id": candidate_id, "p_deal": deal})


def insert_new_candidates(rows: list[dict]) -> list[dict]:
    """Insert leads, skipping any source_key already queued (so re-runs never
    reset a reviewed candidate back to pending). Returns the inserted rows'
    id and source_key."""
    if not rows:
        return []
    added = _post(
        "deal_candidates?on_conflict=source_key&select=id,source_key",
        _uniform(rows),
        prefer="resolution=ignore-duplicates,return=representation",
    )
    return added or []


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


def delete_stale_deals(prefix: str, keep_keys: list[str]) -> int:
    """Unpublish deals under `prefix` whose source_key is no longer listed,
    so removing an entry from a curated file removes it from the site."""
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    query = f"source_key=like.{urllib.parse.quote(prefix)}*"
    if keep_keys:
        listed = ",".join(f'"{k}"' for k in keep_keys)
        query += f"&source_key=not.in.({urllib.parse.quote(listed)})"
    request = urllib.request.Request(
        f"{url}/rest/v1/deals?{query}&select=id",
        method="DELETE",
        headers={**_headers(key), "Prefer": "return=representation"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return len(json.loads(response.read() or b"[]"))
    except urllib.error.HTTPError as err:
        raise SupabaseError(f"{err.code}: {err.read().decode(errors='replace')}") from err


def run_housekeeping() -> dict:
    return _post("rpc/run_housekeeping", {}) or {}
