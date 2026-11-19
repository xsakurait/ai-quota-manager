#!/usr/bin/env python3
"""Modal reader: produce a LiveReading for the `modal` service from the
Modal Workspace billing API and merge it into ./data/readings.json.

Run this AS THE MODAL ACCOUNT OWNER, with API token credentials in the
environment (never pass them as arguments — they would leak into shell
history / process listings):

    export MODAL_TOKEN_ID=...        # Modal dashboard -> Settings -> API Tokens
    export MODAL_TOKEN_SECRET=...
    python3 scripts/readers/modal_billing.py

Behavior (same merge semantics as scripts/readers/codex.mjs):
- Merges { serviceId: "modal", source: "modal-billing-api", ... } into
  ./data/readings.json, preserving other services' entries and replacing
  any previous entry with the same serviceId.
- Missing env vars, a missing `modal` SDK, or a failed API call (e.g. the
  billing report API is Team/Enterprise-only, so a Starter workspace may
  be rejected) all print a message and exit 0 WITHOUT touching the file.
- Token values are never printed.
"""
import json
import os
import sys
from datetime import datetime, timezone

SERVICE_ID = "modal"
SOURCE = "modal-billing-api"
# Starter plan free credit, USD/month. Mirrors the `modal` entry's limit
# in src/shared/config/catalog.ts (single source of truth on the app side;
# duplicated here only so this script stays dependency-free).
FREE_CREDIT_USD = 30
MONTHLY_WINDOW_MINUTES = 43200


def fetch_monthly_spend_usd() -> float:
    """Return the current billing cycle's total Modal spend in USD.

    This is the ONLY function that talks to the Modal SDK, so any SDK
    version differences are contained here. It uses the documented
    Workspace billing surface: Workspace.from_context().billing.summary()
    returns a WorkspaceBillingSummary whose ``metered_cost`` is the
    cycle's spend before adjustments (a Decimal in USD). The SDK reads
    MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from the environment itself.
    Docs: https://modal.com/docs/sdk/py/latest/Workspace
    """
    import modal

    summary = modal.Workspace.from_context().billing.summary()
    return float(summary.metered_cost)


def next_month_start_unix(now: datetime) -> int:
    """Unix seconds of the 1st of next month, 00:00 UTC."""
    if now.month == 12:
        nxt = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        nxt = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    return int(nxt.timestamp())


def main() -> int:
    missing = [name for name in ("MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET") if not os.environ.get(name)]
    if missing:
        print(
            "[modal-reader] Missing environment variable(s): "
            + ", ".join(missing)
            + ". Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET (Modal dashboard -> "
            "Settings -> API Tokens) and re-run. Nothing was written."
        )
        return 0

    try:
        import modal  # noqa: F401
    except ImportError:
        print("[modal-reader] The `modal` Python SDK is not installed. Install it with `pip install modal`. Nothing was written.")
        return 0

    try:
        spend = fetch_monthly_spend_usd()
    except Exception as exc:  # e.g. permission error on the Starter plan
        print(f"[modal-reader] Modal billing API call failed: {type(exc).__name__}: {exc}. Nothing was written.")
        return 0

    now = datetime.now(timezone.utc)
    used_percent = round(spend / FREE_CREDIT_USD * 100, 1)
    reading = {
        "serviceId": SERVICE_ID,
        "source": SOURCE,
        "capturedAt": now.isoformat().replace("+00:00", "Z"),
        "windows": [
            {
                "windowMinutes": MONTHLY_WINDOW_MINUTES,
                "usedPercent": used_percent,
                "resetsAt": next_month_start_unix(now),
            }
        ],
        "note": f"今月 ${spend:.2f} / ${FREE_CREDIT_USD} 使用",
    }

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
    kept = [
        r
        for r in existing
        if not (isinstance(r, dict) and r.get("serviceId") == SERVICE_ID and (r.get("accountId") or "") == "")
    ]
    kept.append(reading)
    os.makedirs(data_dir, exist_ok=True)
    with open(readings_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"readings": kept}, ensure_ascii=False, indent=2) + "\n")
    print(
        f"[modal-reader] Wrote {SERVICE_ID} reading (spend ${spend:.2f} of ${FREE_CREDIT_USD}, "
        f"{used_percent}% used) to {readings_path}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
