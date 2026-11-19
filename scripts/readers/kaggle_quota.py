#!/usr/bin/env python3
"""Kaggle reader: produce LiveReadings for the `kaggle` (GPU) and
`kaggle-tpu` (TPU) services from Kaggle's accelerator quota endpoint and
merge them into ./data/readings.json.

The endpoint is the one behind the official Kaggle MCP server's
`get_accelerator_quota` tool (https://www.kaggle.com/mcp):

    POST https://api.kaggle.com/v1/kernels.KernelsApiService/GetAcceleratorQuotaStatistics
    Authorization: Bearer <KGAT API token>
    Content-Type: application/json
    Body: {} (Connect-RPC JSON style)

(The www.kaggle.com host without the /api/v1 prefix returns HTTP 400;
api.kaggle.com/v1 is the correct base — verified live 2026-11-19. The
verified response shape is:

    {"quotaRefreshTime": "2026-11-21T00:00:00Z",
     "gpuQuota": {"timeUsed": "8737.256s", "timeReserved": "0s",
                  "totalTimeAllowed": "108000s",
                  "minimumTimeAllowed": "108000s", "hasEverRun": true},
     "tpuQuota": {"timeUsed": "0s", "timeReserved": "0s",
                  "totalTimeAllowed": "72000s",
                  "minimumTimeAllowed": "72000s"}}

Durations are protobuf-style strings in seconds; quotaRefreshTime is
the real weekly reset instant. The official kagglesdk crashes parsing
this response — its TimeDelta parser expects fractional seconds — so
this reader parses the raw JSON itself.)

Run this AS THE KAGGLE ACCOUNT OWNER, with the API token in the
environment (never pass it as an argument — it would leak into shell
history / process listings):

    export KAGGLE_API_TOKEN=...     # https://www.kaggle.com/settings/api
    python3 scripts/readers/kaggle_quota.py

Standard library only (urllib / json / os / datetime / re).

Behavior (same merge semantics as scripts/readers/codex.mjs and
scripts/readers/modal_billing.py):
- Merges { serviceId: "kaggle" | "kaggle-tpu", source: "kaggle-api", ... }
  into ./data/readings.json, preserving other services' entries and
  replacing any previous entries for the services it writes.
- The parser first tries the live-verified shape above
  (extract_verified_stats). The endpoint is still not a stable public
  contract, so a deliberately tolerant generic extractor
  (extract_accelerator_stats) remains as a fallback. If nothing
  recognizable is found, the HTTP status and a truncated response body
  are printed for diagnosis and the script exits 0 WITHOUT touching
  the file.
- Missing env var, network errors, and HTTP errors all print a message
  and exit 0 WITHOUT touching the file.
- The token value is never printed.

Note on resetsAt: taken from the response's quotaRefreshTime (the
real weekly reset instant) whenever present. Only when it is absent
does resetsAt fall back to an APPROXIMATION — next Monday 00:00 UTC —
which should be treated as a guide, not an exact deadline.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, time, timedelta, timezone

ENDPOINT = "https://api.kaggle.com/v1/kernels.KernelsApiService/GetAcceleratorQuotaStatistics"
SOURCE = "kaggle-api"
WEEKLY_WINDOW_MINUTES = 10080
# Catalog ids (src/shared/config/catalog.ts) per accelerator type. GPU and
# TPU are separate services because the app models one quota per service.
SERVICE_IDS = {"gpu": "kaggle", "tpu": "kaggle-tpu"}
LABELS = {"gpu": "GPU", "tpu": "TPU"}
USED_KEY_HINTS = ("used", "usage", "consumed", "elapsed")
QUOTA_KEY_HINTS = ("quota", "limit", "allowance", "allotted", "total")
TYPE_KEY_HINTS = ("accelerator", "type", "kind", "name")


def as_number(value):
    """Best-effort numeric extraction from a JSON value.

    Returns (number, unit) where unit is "seconds" / "minutes" / "hours"
    or None when unknown. Handles plain numbers, numeric strings,
    protobuf Duration JSON strings ("18000s"), and structured protobuf
    Durations ({"seconds": 18000, "nanos": 0}). Returns None when the
    value carries no usable number.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value), None
    if isinstance(value, str):
        text = value.strip()
        match = re.fullmatch(r"(-?\d+(?:\.\d+)?)s", text)
        if match:
            return float(match.group(1)), "seconds"
        try:
            return float(text), None
        except ValueError:
            return None
    if isinstance(value, dict) and "seconds" in value:
        inner = as_number(value.get("seconds"))
        if inner is not None:
            return inner[0], "seconds"
    return None


def unit_from_key(key):
    if "second" in key:
        return "seconds"
    if "minute" in key:
        return "minutes"
    if "hour" in key:
        return "hours"
    return None


def accelerator_in_text(text):
    """Return "gpu" / "tpu" if the text names an accelerator, else None."""
    lowered = text.lower()
    if "gpu" in lowered:
        return "gpu"
    if "tpu" in lowered:
        return "tpu"
    return None


def scan_scalars(node, accel, found):
    """Collect used/quota figures for one accelerator from a dict's own
    scalar entries. `accel` is the accelerator this dict is attributed
    to (may be None); a key naming an accelerator overrides it, so flat
    shapes like {"gpuTimeUsed": ..., "gpuQuota": ...} also work."""
    for key, value in node.items():
        number = as_number(value)
        if number is None:
            continue
        lowered = key.lower()
        effective = accelerator_in_text(lowered) or accel
        if effective is None:
            continue
        slot = found.setdefault(effective, {})
        unit = number[1] or unit_from_key(lowered)
        if any(hint in lowered for hint in USED_KEY_HINTS):
            slot.setdefault("used", (number[0], unit))
        elif any(hint in lowered for hint in QUOTA_KEY_HINTS):
            slot.setdefault("quota", (number[0], unit))


def walk(node, accel, found):
    """Recursively walk the response JSON, tracking which accelerator
    the current subtree belongs to (from dict keys naming gpu/tpu, or a
    type-ish field's string value), and harvest used/quota pairs."""
    if isinstance(node, dict):
        current = accel
        for key, value in node.items():
            key_accel = accelerator_in_text(key)
            if key_accel is not None and isinstance(value, (dict, list)):
                current = key_accel
            if isinstance(value, str) and any(hint in key.lower() for hint in TYPE_KEY_HINTS):
                value_accel = accelerator_in_text(value)
                if value_accel is not None:
                    current = value_accel
        scan_scalars(node, current, found)
        for key, value in node.items():
            child_accel = accelerator_in_text(key) or current
            walk(value, child_accel, found)
    elif isinstance(node, list):
        for item in node:
            walk(item, accel, found)


def extract_accelerator_stats(payload):
    """Return {accel: {"used": (value, unit), "quota": (value, unit)}}
    for accelerators with a complete used+quota pair."""
    found = {}
    walk(payload, None, found)
    return {
        accel: slot
        for accel, slot in found.items()
        if accel in SERVICE_IDS and "used" in slot and "quota" in slot
    }


def duration_to_seconds(value):
    """Seconds from a protobuf-Duration-style value: a duration string
    ("8737.256s", "0s"), a plain number / numeric string (seconds), or a
    structured {"seconds": ...}. Returns None when unusable."""
    parsed = as_number(value)
    if parsed is None:
        return None
    number, unit = parsed
    if unit == "minutes":
        return number * 60
    if unit == "hours":
        return number * 3600
    return number  # "seconds", or unit-less (these fields are durations)


def extract_verified_stats(payload):
    """PRIMARY parser for the live-verified response shape
    (2026-11-19): top-level gpuQuota / tpuQuota objects whose timeUsed
    and totalTimeAllowed are protobuf duration strings in seconds.
    Returns {accel: {"used_seconds": float, "total_seconds": float}}
    for accelerators with a complete pair."""
    if not isinstance(payload, dict):
        return {}
    stats = {}
    for accel, key in (("gpu", "gpuQuota"), ("tpu", "tpuQuota")):
        node = payload.get(key)
        if not isinstance(node, dict):
            continue
        used = duration_to_seconds(node.get("timeUsed"))
        total = duration_to_seconds(node.get("totalTimeAllowed"))
        if used is None or total is None:
            continue
        stats[accel] = {"used_seconds": used, "total_seconds": total}
    return stats


def parse_refresh_time(payload):
    """Unix seconds of the response's quotaRefreshTime (ISO 8601, the
    real weekly reset instant), or None when absent/unparseable."""
    if not isinstance(payload, dict):
        return None
    raw = payload.get("quotaRefreshTime")
    if not isinstance(raw, str):
        return None
    try:
        parsed = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp())


def pair_to_hours(used, quota):
    """Convert a (value, unit) used/quota pair to hours. The pair is
    assumed to share a unit; when neither side names one, infer it from
    the quota's magnitude (Kaggle quotas: 30h/20h == 1800/1200 minutes
    == 108000/72000 seconds)."""
    used_value, used_unit = used
    quota_value, quota_unit = quota
    shared = used_unit or quota_unit
    if shared is None:
        if quota_value >= 10000:
            shared = "seconds"
        elif quota_value >= 500:
            shared = "minutes"
        else:
            shared = "hours"

    def convert(value, unit):
        unit = unit or shared
        if unit == "seconds":
            return value / 3600
        if unit == "minutes":
            return value / 60
        return value

    return convert(used_value, used_unit), convert(quota_value, quota_unit)


def format_hours(hours):
    return str(int(hours)) if float(hours).is_integer() else f"{hours:.1f}"


def next_monday_midnight_unix(now):
    """Unix seconds of next Monday 00:00 UTC (strictly in the future).
    Approximation of Kaggle's weekly reset — see module docstring."""
    days_ahead = (7 - now.date().weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    target = datetime.combine(now.date() + timedelta(days=days_ahead), time.min, tzinfo=timezone.utc)
    return int(target.timestamp())


def fetch_quota_response(token):
    """POST to the quota endpoint. Returns (http_status, body_text).
    Raises urllib.error.URLError on transport failure."""
    request = urllib.request.Request(ENDPOINT, data=b"{}", method="POST")
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Content-Type", "application/json")
    request.add_header("User-Agent", "ai-quota-manager kaggle_quota reader")
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
            with open(readings_path, encoding="utf-8") as fh:
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
    token = os.environ.get("KAGGLE_API_TOKEN")
    if not token:
        print(
            "[kaggle-reader] Missing environment variable: KAGGLE_API_TOKEN. "
            "Create a KGAT API token at https://www.kaggle.com/settings/api, "
            "set KAGGLE_API_TOKEN, and re-run. Nothing was written."
        )
        return 0

    try:
        status, body = fetch_quota_response(token)
    except Exception as exc:  # DNS / TLS / timeout etc.
        print(f"[kaggle-reader] Kaggle quota request failed: {type(exc).__name__}: {exc}. Nothing was written.")
        return 0

    if status != 200:
        print(
            f"[kaggle-reader] Kaggle quota endpoint returned HTTP {status}. "
            f"Response body (truncated): {body[:500]}. Nothing was written."
        )
        return 0

    try:
        payload = json.loads(body)
    except ValueError:
        print(
            f"[kaggle-reader] HTTP 200 but the response was not JSON. "
            f"Response body (truncated): {body[:500]}. Nothing was written."
        )
        return 0

    now = datetime.now(timezone.utc)
    # resetsAt: the response's quotaRefreshTime is the real reset
    # instant; the next-Monday approximation is only a fallback.
    resets_at = parse_refresh_time(payload)
    if resets_at is None:
        resets_at = next_monday_midnight_unix(now)

    # Normalize both parsers to (accel, used_hours, quota_hours,
    # used_percent) entries. Primary: the live-verified shape.
    # Fallback: the generic tolerant extractor, in case the shape
    # changes again.
    entries = []
    verified = extract_verified_stats(payload)
    stats = {}
    if verified:
        for accel in ("gpu", "tpu"):
            if accel not in verified:
                continue
            used_seconds = verified[accel]["used_seconds"]
            total_seconds = verified[accel]["total_seconds"]
            if total_seconds <= 0:
                continue
            entries.append(
                (
                    accel,
                    used_seconds / 3600,
                    total_seconds / 3600,
                    round(used_seconds / total_seconds * 100, 1),
                )
            )
    else:
        stats = extract_accelerator_stats(payload)
        for accel in ("gpu", "tpu"):
            if accel not in stats:
                continue
            used_hours, quota_hours = pair_to_hours(stats[accel]["used"], stats[accel]["quota"])
            if quota_hours <= 0:
                continue
            entries.append((accel, used_hours, quota_hours, round(used_hours / quota_hours * 100, 1)))

    if not entries:
        if not verified and not stats:
            print(
                f"[kaggle-reader] HTTP 200 but no GPU/TPU used+quota pair was recognized in the response. "
                f"Response body (truncated): {body[:500]}. Nothing was written."
            )
        else:
            print(
                f"[kaggle-reader] HTTP 200 but all recognized quotas were zero. "
                f"Response body (truncated): {body[:500]}. Nothing was written."
            )
        return 0

    readings = []
    summaries = []
    for accel, used_hours, quota_hours, used_percent in entries:
        readings.append(
            {
                "serviceId": SERVICE_IDS[accel],
                "source": SOURCE,
                "capturedAt": now.isoformat().replace("+00:00", "Z"),
                "windows": [
                    {
                        "windowMinutes": WEEKLY_WINDOW_MINUTES,
                        "usedPercent": used_percent,
                        "resetsAt": resets_at,
                    }
                ],
                "note": f"{LABELS[accel]} {used_hours:.1f}h / {format_hours(quota_hours)}h 使用",
            }
        )
        summaries.append(f"{LABELS[accel]} {used_hours:.1f}h / {format_hours(quota_hours)}h ({used_percent}% used)")

    readings_path = merge_readings(readings)
    print(f"[kaggle-reader] Wrote {len(readings)} reading(s) ({'; '.join(summaries)}) to {readings_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
