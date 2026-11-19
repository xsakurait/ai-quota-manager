#!/usr/bin/env python3
"""Civitai reader: produce a balance LiveReading for the `civitai`
service from Civitai's Buzz account endpoint and merge it into
./data/readings.json.

Buzz is Civitai's currency. The free color is Blue Buzz (daily rewards
reset 00:00 UTC, plus community actions); Yellow / Green Buzz exist
alongside it. Buzz is a STORED BALANCE, not a consumable quota with a
limit, so this reader records the balance itself (in the window's
`detail` field) rather than a usedPercent.

Endpoint background (researched 2026-11-19 from official sources):
- Civitai's official developer docs describe the Buzz balance as read
  via the tRPC procedure `buzz.getUserAccount` (OAuth, BuzzRead
  scope). GET /api/v1/me does NOT return a balance.
- Civitai's own CLI design doc (github.com/civitai/cli) verified live
  that a PERSONAL API KEY also authenticates tRPC calls, and that
  `buzz.getBuzzAccount` returns HTTP 200 with the real balance (a bad
  token gets 401). The web app itself calls trpc.buzz.getBuzzAccount
  and reads per-color balances (buzzAccounts.blue / .yellow / .green).

So this reader uses, with the personal API key as a bearer token:

    GET https://civitai.com/api/trpc/buzz.getBuzzAccount
    Authorization: Bearer <personal API key>

and, if that returns an HTTP error, falls back ONCE to:

    GET https://civitai.com/api/trpc/buzz.getUserAccount

tRPC GET responses are enveloped as
{"result": {"data": {"json": ... }}}; the envelope is unwrapped
defensively (a bare object is also accepted). The account payload
shape is not fully documented, so the parser searches the unwrapped
JSON recursively for blue / yellow / green keys whose values are
numbers or objects carrying a numeric balance-like field (balance,
amount, total, value).

STATUS: not yet live-verified. The endpoint and auth scheme rest on
the official docs and the official CLI's live verification above, but
this reader itself has not yet run against the real API; the first
live run may require envelope/payload adjustments. Failures print the
HTTP status and a truncated body to make that diagnosis easy.

Run this AS THE CIVITAI ACCOUNT OWNER, with the API key in the
environment (never pass it as an argument — it would leak into shell
history / process listings):

    export CIVITAI_API_TOKEN=...   # Civitai account settings -> API Keys
    python3 scripts/readers/civitai_buzz.py

Standard library only (urllib / json / os / datetime).

Behavior (same merge semantics as scripts/readers/kaggle_quota.py):
- Merges { serviceId: "civitai", source: "civitai-api", ... } into
  ./data/readings.json, preserving other services' entries and
  replacing any previous `civitai` entry.
- The written window is a BALANCE window: windowMinutes 1440 with
  resetsAt at the next 00:00 UTC (the daily-reward checkpoint) and a
  `detail` string carrying the balance, e.g. "Blue Buzz 残高 1500".
  App-side rendering of detail windows is handled separately.
- If no color balance can be recognized, or both procedures fail,
  a one-line summary is printed and the script exits 0 WITHOUT
  touching the file.
- Missing env var, network errors, and HTTP errors all print a
  message and exit 0 WITHOUT touching the file.
- The token value is never printed.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, time, timedelta, timezone

PRIMARY_URL = "https://civitai.com/api/trpc/buzz.getBuzzAccount"
FALLBACK_URL = "https://civitai.com/api/trpc/buzz.getUserAccount"
PRIMARY_NAME = "buzz.getBuzzAccount"
FALLBACK_NAME = "buzz.getUserAccount"
SOURCE = "civitai-api"
SERVICE_ID = "civitai"
DAILY_WINDOW_MINUTES = 1440
# Buzz colors, in display order. Blue is the free currency and the one
# the catalog entry tracks, so it is preferred for the window detail.
COLORS = ("blue", "yellow", "green")
LABELS = {"blue": "Blue", "yellow": "Yellow", "green": "Green"}
BALANCE_KEY_HINTS = ("balance", "amount", "total", "value")


def unwrap_trpc(payload):
    """Strip the tRPC envelope {"result": {"data": {"json": ... }}}
    and return the inner payload. A bare (unenveloped) payload is
    returned as-is."""
    if isinstance(payload, dict):
        result = payload.get("result")
        if isinstance(result, dict):
            data = result.get("data")
            if isinstance(data, dict) and "json" in data:
                return data["json"]
            if data is not None:
                return data
    return payload


def as_balance(value):
    """Best-effort balance extraction from a JSON value: a plain
    number, a numeric string, or an object carrying a numeric
    balance-like field (balance / amount / total / value). Returns
    None when the value carries no usable number."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    if isinstance(value, dict):
        for hint in BALANCE_KEY_HINTS:
            if hint in value:
                number = as_balance(value[hint])
                if number is not None:
                    return number
    return None


def find_color_balances(node, found):
    """Recursively search the payload for blue / yellow / green keys
    whose values resolve to a balance. First hit per color wins."""
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(key, str):
                color = key.lower()
                if color in COLORS and color not in found:
                    balance = as_balance(value)
                    if balance is not None:
                        found[color] = balance
            find_color_balances(value, found)
    elif isinstance(node, list):
        for item in node:
            find_color_balances(item, found)


def extract_balances(payload):
    """Return {color: balance} for the Buzz colors found in the
    (enveloped or bare) tRPC payload."""
    found = {}
    find_color_balances(unwrap_trpc(payload), found)
    return found


def format_amount(value):
    """Plain integer formatting (no thousands separators) for integral
    balances; non-integral values keep up to 2 decimals."""
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def next_utc_midnight_unix(now):
    """Unix seconds of the next 00:00 UTC (strictly in the future) —
    the daily Buzz reward checkpoint used as the balance window's
    resetsAt."""
    target = datetime.combine(now.date() + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return int(target.timestamp())


def fetch_account(token, url):
    """GET a tRPC procedure. Returns (http_status, body_text).
    Raises urllib.error.URLError on transport failure."""
    request = urllib.request.Request(url, method="GET")
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Accept", "application/json")
    request.add_header("User-Agent", "ai-quota-manager civitai_buzz reader")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", "replace")


def merge_readings(new_readings):
    """Merge readings into ./data/readings.json, preserving other
    services' entries and replacing same-serviceId ones. Returns the
    readings file path."""
    data_dir = os.path.join(os.getcwd(), "data")
    readings_path = os.path.join(data_dir, "readings.json")
    existing = []
    if os.path.exists(readings_path):
        try:
            # utf-8-sig tolerates a BOM (e.g. when readings.json was last
            # written by Windows PowerShell 5.1 Set-Content -Encoding UTF8);
            # plain utf-8 would fail to parse and silently drop entries.
            with open(readings_path, encoding="utf-8-sig") as fh:
                parsed = json.load(fh)
            entries = parsed if isinstance(parsed, list) else parsed.get("readings")
            if isinstance(entries, list):
                existing = entries
        except (OSError, ValueError, AttributeError):
            existing = []
    replaced_ids = {r["serviceId"] for r in new_readings}
    kept = [
        r
        for r in existing
        if not (isinstance(r, dict) and r.get("serviceId") in replaced_ids and (r.get("accountId") or "") == "")
    ]
    kept.extend(new_readings)
    os.makedirs(data_dir, exist_ok=True)
    with open(readings_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"readings": kept}, ensure_ascii=False, indent=2) + "\n")
    return readings_path


def main() -> int:
    token = os.environ.get("CIVITAI_API_TOKEN")
    if not token:
        print(
            "[civitai-reader] Missing environment variable: CIVITAI_API_TOKEN. "
            "Create a personal API key in your Civitai account settings (API Keys section), "
            "set CIVITAI_API_TOKEN, and re-run. Nothing was written."
        )
        return 0

    attempts = [(PRIMARY_NAME, PRIMARY_URL), (FALLBACK_NAME, FALLBACK_URL)]
    balances = {}
    used_name = None
    last_problem = None
    for index, (name, url) in enumerate(attempts):
        try:
            status, body = fetch_account(token, url)
        except Exception as exc:  # DNS / TLS / timeout etc.
            print(f"[civitai-reader] Civitai request to {name} failed: {type(exc).__name__}: {exc}. Nothing was written.")
            return 0

        if status != 200:
            last_problem = f"{name} returned HTTP {status}"
            if index + 1 < len(attempts):
                continue  # fall back once to the documented procedure
            print(
                f"[civitai-reader] Both Civitai procedures failed ({last_problem}). "
                f"Last response body (truncated): {body[:500]}. Nothing was written."
            )
            return 0

        try:
            payload = json.loads(body)
        except ValueError:
            print(
                f"[civitai-reader] {name} returned HTTP 200 but the response was not JSON. "
                f"Response body (truncated): {body[:500]}. Nothing was written."
            )
            return 0

        balances = extract_balances(payload)
        if not balances:
            print(
                f"[civitai-reader] {name} returned HTTP 200 but no blue/yellow/green Buzz balance was recognized. "
                f"Response body (truncated): {body[:500]}. Nothing was written."
            )
            return 0
        used_name = name
        break

    now = datetime.now(timezone.utc)
    found_colors = [color for color in COLORS if color in balances]
    # The window detail leads with Blue (the free currency); if Blue is
    # absent, fall back to the first color actually found.
    detail_color = "blue" if "blue" in balances else found_colors[0]
    detail = f"{LABELS[detail_color]} Buzz 残高 {format_amount(balances[detail_color])}"
    note = " / ".join(f"{LABELS[color]} {format_amount(balances[color])}" for color in found_colors)

    reading = {
        "serviceId": SERVICE_ID,
        "source": SOURCE,
        "capturedAt": now.isoformat().replace("+00:00", "Z"),
        "windows": [
            {
                "windowMinutes": DAILY_WINDOW_MINUTES,
                "resetsAt": next_utc_midnight_unix(now),
                "detail": detail,
            }
        ],
        "note": note,
    }

    readings_path = merge_readings([reading])
    print(f"[civitai-reader] Wrote civitai reading via {used_name} ({note}) to {readings_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
