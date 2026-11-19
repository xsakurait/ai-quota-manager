import { describe, expect, it } from "vitest";
import {
  findReading,
  isStale,
  parseLiveReading,
  parseReadingWindow,
  parseReadings,
  windowLabel,
} from "../src/shared/lib/readings";
import type { LiveReading } from "../src/shared/types";

const NOW = new Date("2026-11-19T12:00:00.000Z");
const FUTURE = Math.floor(Date.parse("2026-11-20T00:00:00.000Z") / 1000);
const PAST = Math.floor(Date.parse("2026-11-19T00:00:00.000Z") / 1000);

const validWindow = { windowMinutes: 300, usedPercent: 42, resetsAt: FUTURE };
const validEntry = {
  serviceId: "codex",
  source: "codex-rollout",
  capturedAt: "2026-11-19T11:00:00.000Z",
  windows: [validWindow],
};

const reading = (over: Partial<LiveReading> = {}): LiveReading => ({
  serviceId: "codex",
  source: "codex-rollout",
  capturedAt: "2026-11-19T11:00:00.000Z",
  windows: [{ windowMinutes: 300, usedPercent: 42, resetsAt: FUTURE }],
  ...over,
});

describe("parseReadingWindow", () => {
  it("parses a well-formed window", () => {
    expect(parseReadingWindow(validWindow)).toEqual(validWindow);
  });
  it("rejects non-objects", () => {
    expect(parseReadingWindow(null)).toBeNull();
    expect(parseReadingWindow("x")).toBeNull();
    expect(parseReadingWindow(42)).toBeNull();
    expect(parseReadingWindow([validWindow])).toBeNull();
    expect(parseReadingWindow(undefined)).toBeNull();
  });
  it("rejects missing or non-numeric fields", () => {
    expect(parseReadingWindow({ usedPercent: 1, resetsAt: 2 })).toBeNull();
    expect(parseReadingWindow({ windowMinutes: 300, resetsAt: 2 })).toBeNull();
    expect(parseReadingWindow({ windowMinutes: 300, usedPercent: 1 })).toBeNull();
    expect(parseReadingWindow({ windowMinutes: "300", usedPercent: 1, resetsAt: 2 })).toBeNull();
    expect(parseReadingWindow({ windowMinutes: 300, usedPercent: Number.NaN, resetsAt: 2 })).toBeNull();
    expect(parseReadingWindow({ windowMinutes: 300, usedPercent: 1, resetsAt: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe("parseLiveReading", () => {
  it("parses a minimal valid reading", () => {
    expect(parseLiveReading(validEntry)).toEqual({
      serviceId: "codex",
      source: "codex-rollout",
      capturedAt: "2026-11-19T11:00:00.000Z",
      windows: [validWindow],
    });
  });
  it("keeps a non-empty accountId and a string note", () => {
    const parsed = parseLiveReading({ ...validEntry, accountId: "primary", note: "メモ" });
    expect(parsed?.accountId).toBe("primary");
    expect(parsed?.note).toBe("メモ");
  });
  it("ignores an empty or non-string accountId and a non-string note", () => {
    const a = parseLiveReading({ ...validEntry, accountId: "", note: 42 });
    expect(a?.accountId).toBeUndefined();
    expect(a?.note).toBeUndefined();
    const b = parseLiveReading({ ...validEntry, accountId: 7 });
    expect(b?.accountId).toBeUndefined();
  });
  it("rejects non-objects", () => {
    expect(parseLiveReading(null)).toBeNull();
    expect(parseLiveReading("x")).toBeNull();
    expect(parseLiveReading([validEntry])).toBeNull();
  });
  it("rejects a missing, empty or non-string serviceId or source", () => {
    expect(parseLiveReading({ ...validEntry, serviceId: undefined })).toBeNull();
    expect(parseLiveReading({ ...validEntry, serviceId: "" })).toBeNull();
    expect(parseLiveReading({ ...validEntry, serviceId: 3 })).toBeNull();
    expect(parseLiveReading({ ...validEntry, source: undefined })).toBeNull();
    expect(parseLiveReading({ ...validEntry, source: "" })).toBeNull();
    expect(parseLiveReading({ ...validEntry, source: null })).toBeNull();
  });
  it("rejects a missing, non-string or unparseable capturedAt", () => {
    expect(parseLiveReading({ ...validEntry, capturedAt: undefined })).toBeNull();
    expect(parseLiveReading({ ...validEntry, capturedAt: 123 })).toBeNull();
    expect(parseLiveReading({ ...validEntry, capturedAt: "not-a-date" })).toBeNull();
  });
  it("rejects missing, non-array or effectively empty windows", () => {
    expect(parseLiveReading({ ...validEntry, windows: undefined })).toBeNull();
    expect(parseLiveReading({ ...validEntry, windows: "x" })).toBeNull();
    expect(parseLiveReading({ ...validEntry, windows: [] })).toBeNull();
    expect(parseLiveReading({ ...validEntry, windows: [{ nope: 1 }] })).toBeNull();
  });
  it("keeps only the valid windows from a mixed list", () => {
    const parsed = parseLiveReading({ ...validEntry, windows: [{ nope: 1 }, validWindow, null] });
    expect(parsed?.windows).toEqual([validWindow]);
  });
});

describe("parseReadings", () => {
  it("returns [] for invalid JSON", () => {
    expect(parseReadings("{oops")).toEqual([]);
    expect(parseReadings("")).toEqual([]);
  });
  it("parses the { readings: [...] } envelope", () => {
    const text = JSON.stringify({ readings: [validEntry] });
    expect(parseReadings(text)).toEqual([expect.objectContaining({ serviceId: "codex" })]);
  });
  it("parses a bare array root", () => {
    const text = JSON.stringify([validEntry]);
    expect(parseReadings(text)).toHaveLength(1);
  });
  it("returns [] for non-list roots", () => {
    expect(parseReadings("42")).toEqual([]);
    expect(parseReadings("null")).toEqual([]);
    expect(parseReadings('"str"')).toEqual([]);
    expect(parseReadings("{}")).toEqual([]);
    expect(parseReadings('{"readings": "nope"}')).toEqual([]);
    expect(parseReadings('{"readings": null}')).toEqual([]);
  });
  it("skips invalid entries and keeps valid ones", () => {
    const text = JSON.stringify({ readings: [null, { bad: true }, validEntry] });
    const result = parseReadings(text);
    expect(result).toHaveLength(1);
    expect(result[0].serviceId).toBe("codex");
  });
});

describe("findReading", () => {
  const list: LiveReading[] = [
    reading(),
    reading({ serviceId: "muse", accountId: "primary" }),
    reading({ serviceId: "muse", accountId: "sub" }),
  ];
  it("finds a reading without an account", () => {
    expect(findReading(list, "codex")).toBe(list[0]);
    expect(findReading(list, "codex", undefined)).toBe(list[0]);
    expect(findReading(list, "codex", "")).toBe(list[0]);
  });
  it("finds a reading for a specific account", () => {
    expect(findReading(list, "muse", "primary")).toBe(list[1]);
    expect(findReading(list, "muse", "sub")).toBe(list[2]);
  });
  it("does not match across account boundaries", () => {
    expect(findReading(list, "muse")).toBeUndefined();
    expect(findReading(list, "muse", "unknown")).toBeUndefined();
    expect(findReading(list, "codex", "primary")).toBeUndefined();
  });
  it("returns undefined for unknown services and empty lists", () => {
    expect(findReading(list, "runway")).toBeUndefined();
    expect(findReading([], "codex")).toBeUndefined();
  });
});

describe("isStale", () => {
  it("is fresh when recently captured and a window is still open", () => {
    expect(isStale(reading(), NOW)).toBe(false);
  });
  it("is stale when captured more than the configured hours ago", () => {
    const old = reading({ capturedAt: "2026-11-18T11:59:59.000Z" });
    expect(isStale(old, NOW)).toBe(true);
  });
  it("is not stale at exactly the configured age boundary", () => {
    const boundary = reading({ capturedAt: "2026-11-18T12:00:00.000Z" });
    expect(isStale(boundary, NOW)).toBe(false);
  });
  it("is stale when every window has already reset, even if fresh", () => {
    const passed = reading({
      windows: [
        { windowMinutes: 300, usedPercent: 90, resetsAt: PAST },
        { windowMinutes: 10080, usedPercent: 10, resetsAt: PAST },
      ],
    });
    expect(isStale(passed, NOW)).toBe(true);
  });
  it("is fresh when at least one window is still open", () => {
    const mixed = reading({
      windows: [
        { windowMinutes: 300, usedPercent: 90, resetsAt: PAST },
        { windowMinutes: 10080, usedPercent: 10, resetsAt: FUTURE },
      ],
    });
    expect(isStale(mixed, NOW)).toBe(false);
  });
  it("treats a reading with no windows as stale when fresh", () => {
    expect(isStale(reading({ windows: [] }), NOW)).toBe(true);
  });
  it("uses the current time by default", () => {
    const fresh = reading({
      capturedAt: new Date().toISOString(),
      windows: [{ windowMinutes: 300, usedPercent: 1, resetsAt: Math.floor(Date.now() / 1000) + 3600 }],
    });
    expect(isStale(fresh)).toBe(false);
  });
});

describe("windowLabel", () => {
  it("labels the known windows from config", () => {
    expect(windowLabel(300)).toBe("5時間");
    expect(windowLabel(10080)).toBe("週間");
    expect(windowLabel(43200)).toBe("月間");
  });
  it("falls back to a minutes label for unknown windows", () => {
    expect(windowLabel(60)).toBe("60分");
    expect(windowLabel(0)).toBe("0分");
  });
});
