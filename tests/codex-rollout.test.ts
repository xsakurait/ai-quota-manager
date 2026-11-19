import { describe, expect, it } from "vitest";
import { extractLatestRateLimits } from "../src/shared/lib/codex-rollout";

const TS1 = "2026-11-19T01:00:00.000Z";
const TS2 = "2026-11-19T02:00:00.000Z";

function tokenCountLine(
  timestamp: unknown,
  rateLimits: unknown,
  over: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    timestamp,
    type: "event_msg",
    payload: { type: "token_count", rate_limits: rateLimits },
    ...over,
  });
}

const PRIMARY = { used_percent: 42, window_minutes: 300, resets_at: 1795060800 };
const SECONDARY = { used_percent: 10, window_minutes: 10080, resets_at: 1795489200 };
const BOTH = { primary: PRIMARY, secondary: SECONDARY };

describe("extractLatestRateLimits", () => {
  it("extracts primary and secondary windows from a token_count line", () => {
    const result = extractLatestRateLimits(tokenCountLine(TS1, BOTH));
    expect(result).toEqual({
      capturedAt: TS1,
      windows: [
        { windowMinutes: 300, usedPercent: 42, resetsAt: 1795060800 },
        { windowMinutes: 10080, usedPercent: 10, resetsAt: 1795489200 },
      ],
    });
  });
  it("returns the LAST snapshot when several are present", () => {
    const text = [
      tokenCountLine(TS1, BOTH),
      tokenCountLine(TS2, { primary: { used_percent: 99, window_minutes: 300, resets_at: 1795064400 } }),
    ].join("\n");
    const result = extractLatestRateLimits(text);
    expect(result?.capturedAt).toBe(TS2);
    expect(result?.windows).toEqual([{ windowMinutes: 300, usedPercent: 99, resetsAt: 1795064400 }]);
  });
  it("returns null for empty or blank-only input", () => {
    expect(extractLatestRateLimits("")).toBeNull();
    expect(extractLatestRateLimits("\n\n  \n")).toBeNull();
  });
  it("skips malformed JSON lines and keeps scanning", () => {
    const text = ["{not json", tokenCountLine(TS1, BOTH), "}"].join("\n");
    expect(extractLatestRateLimits(text)?.capturedAt).toBe(TS1);
    expect(extractLatestRateLimits("{not json")).toBeNull();
  });
  it("skips non-object JSON lines", () => {
    const text = ["42", "[1,2]", '"text"', "null", "true"].join("\n");
    expect(extractLatestRateLimits(text)).toBeNull();
  });
  it("skips lines whose type is not event_msg", () => {
    const line = tokenCountLine(TS1, BOTH, { type: "response_item" });
    expect(extractLatestRateLimits(line)).toBeNull();
  });
  it("skips lines with a missing or non-object payload", () => {
    const missing = JSON.stringify({ timestamp: TS1, type: "event_msg" });
    const wrongType = JSON.stringify({ timestamp: TS1, type: "event_msg", payload: "x" });
    const arrayPayload = JSON.stringify({ timestamp: TS1, type: "event_msg", payload: [] });
    expect(extractLatestRateLimits(missing)).toBeNull();
    expect(extractLatestRateLimits(wrongType)).toBeNull();
    expect(extractLatestRateLimits(arrayPayload)).toBeNull();
  });
  it("skips lines whose payload type is not token_count", () => {
    const line = JSON.stringify({
      timestamp: TS1,
      type: "event_msg",
      payload: { type: "agent_message", rate_limits: BOTH },
    });
    expect(extractLatestRateLimits(line)).toBeNull();
  });
  it("skips lines with a missing or non-object rate_limits", () => {
    const missing = JSON.stringify({ timestamp: TS1, type: "event_msg", payload: { type: "token_count" } });
    const nulled = tokenCountLine(TS1, null);
    const array = tokenCountLine(TS1, [PRIMARY]);
    const text = tokenCountLine(TS1, "x");
    expect(extractLatestRateLimits(missing)).toBeNull();
    expect(extractLatestRateLimits(nulled)).toBeNull();
    expect(extractLatestRateLimits(array)).toBeNull();
    expect(extractLatestRateLimits(text)).toBeNull();
  });
  it("keeps only the secondary window when primary is null", () => {
    const result = extractLatestRateLimits(tokenCountLine(TS1, { primary: null, secondary: SECONDARY }));
    expect(result?.windows).toEqual([{ windowMinutes: 10080, usedPercent: 10, resetsAt: 1795489200 }]);
  });
  it("keeps only the primary window when secondary is missing", () => {
    const result = extractLatestRateLimits(tokenCountLine(TS1, { primary: PRIMARY }));
    expect(result?.windows).toEqual([{ windowMinutes: 300, usedPercent: 42, resetsAt: 1795060800 }]);
  });
  it("drops windows with non-numeric or missing fields", () => {
    const result = extractLatestRateLimits(
      tokenCountLine(TS1, {
        primary: { used_percent: "42", window_minutes: 300, resets_at: 1795060800 },
        secondary: SECONDARY,
      }),
    );
    expect(result?.windows).toEqual([{ windowMinutes: 10080, usedPercent: 10, resetsAt: 1795489200 }]);
    const missingField = extractLatestRateLimits(
      tokenCountLine(TS1, { primary: { used_percent: 1, window_minutes: 300 } }),
    );
    expect(missingField).toBeNull();
  });
  it("does not let an all-invalid snapshot overwrite an earlier valid one", () => {
    const text = [tokenCountLine(TS1, BOTH), tokenCountLine(TS2, { primary: null, secondary: null })].join("\n");
    const result = extractLatestRateLimits(text);
    expect(result?.capturedAt).toBe(TS1);
    expect(result?.windows).toHaveLength(2);
  });
  it("skips snapshots without a usable timestamp", () => {
    expect(extractLatestRateLimits(tokenCountLine(undefined, BOTH))).toBeNull();
    expect(extractLatestRateLimits(tokenCountLine("", BOTH))).toBeNull();
    expect(extractLatestRateLimits(tokenCountLine(123, BOTH))).toBeNull();
    const text = [tokenCountLine(TS1, BOTH), tokenCountLine(undefined, BOTH)].join("\n");
    expect(extractLatestRateLimits(text)?.capturedAt).toBe(TS1);
  });
  it("handles CRLF line endings and surrounding blank lines", () => {
    const text = `\r\n${tokenCountLine(TS1, BOTH)}\r\n\r\n`;
    expect(extractLatestRateLimits(text)?.capturedAt).toBe(TS1);
  });
});
