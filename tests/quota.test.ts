import { describe, expect, it, vi } from "vitest";
import { CATALOG, CONFIG } from "../src/shared/config/catalog";
import {
  applyDelta,
  buildStatus,
  clampUsage,
  cycleLabel,
  filterServices,
  findService,
  kindLabel,
  loadUsage,
  nextReset,
  normalizeUsed,
  parseUsageInput,
  remaining,
  remainingPercent,
  saveUsage,
  statusLabel,
  statusOf,
  summarize,
  usagePercent,
} from "../src/shared/lib/quota";
import type { ServiceDef } from "../src/shared/types";

const def = (over: Partial<ServiceDef> = {}): ServiceDef => ({
  id: "x",
  name: "X Service",
  kind: "video",
  limit: 100,
  unit: "credits",
  cycle: "daily",
  note: "",
  ...over,
});

describe("normalizeUsed", () => {
  it("returns numbers as-is", () => {
    expect(normalizeUsed(0)).toBe(0);
    expect(normalizeUsed(42)).toBe(42);
    expect(normalizeUsed(3.5)).toBe(3.5);
  });
  it("normalizes negatives to 0", () => {
    expect(normalizeUsed(-1)).toBe(0);
    expect(normalizeUsed(-0.5)).toBe(0);
  });
  it("normalizes non-numbers and non-finite values to 0", () => {
    expect(normalizeUsed("10")).toBe(0);
    expect(normalizeUsed(null)).toBe(0);
    expect(normalizeUsed(undefined)).toBe(0);
    expect(normalizeUsed(true)).toBe(0);
    expect(normalizeUsed({})).toBe(0);
    expect(normalizeUsed(Number.NaN)).toBe(0);
    expect(normalizeUsed(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeUsed(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("clampUsage", () => {
  it("keeps in-range values", () => {
    expect(clampUsage(def(), 0)).toBe(0);
    expect(clampUsage(def(), 50)).toBe(50);
    expect(clampUsage(def(), 100)).toBe(100);
  });
  it("clamps over-limit values to the limit", () => {
    expect(clampUsage(def(), 101)).toBe(100);
    expect(clampUsage(def(), 10000)).toBe(100);
  });
  it("returns 0 when limit is 0 or negative", () => {
    expect(clampUsage(def({ limit: 0 }), 10)).toBe(0);
    expect(clampUsage(def({ limit: -5 }), 10)).toBe(0);
  });
  it("normalizes invalid input", () => {
    expect(clampUsage(def(), "x")).toBe(0);
    expect(clampUsage(def(), -3)).toBe(0);
  });
});

describe("applyDelta", () => {
  it("adds and subtracts within range", () => {
    expect(applyDelta(def(), 10, 1)).toBe(11);
    expect(applyDelta(def(), 10, -1)).toBe(9);
    expect(applyDelta(def(), 10, 25)).toBe(35);
  });
  it("clamps at both ends", () => {
    expect(applyDelta(def(), 100, 1)).toBe(100);
    expect(applyDelta(def(), 0, -1)).toBe(0);
  });
  it("treats invalid delta as 0", () => {
    expect(applyDelta(def(), 10, "1")).toBe(10);
    expect(applyDelta(def(), 10, Number.NaN)).toBe(10);
    expect(applyDelta(def(), 10, Number.POSITIVE_INFINITY)).toBe(10);
    expect(applyDelta(def(), 10, undefined)).toBe(10);
  });
  it("normalizes invalid current value", () => {
    expect(applyDelta(def(), "x", 5)).toBe(5);
    expect(applyDelta(def(), -10, 5)).toBe(5);
  });
});

describe("remaining / usagePercent / remainingPercent", () => {
  it("computes remaining", () => {
    expect(remaining(def(), 0)).toBe(100);
    expect(remaining(def(), 30)).toBe(70);
    expect(remaining(def(), 100)).toBe(0);
    expect(remaining(def(), 150)).toBe(0);
    expect(remaining(def(), -10)).toBe(100);
  });
  it("computes usagePercent with rounding", () => {
    expect(usagePercent(def(), 0)).toBe(0);
    expect(usagePercent(def(), 50)).toBe(50);
    expect(usagePercent(def({ limit: 3 }), 1)).toBe(33);
    expect(usagePercent(def({ limit: 3 }), 2)).toBe(67);
    expect(usagePercent(def(), 100)).toBe(100);
  });
  it("caps usagePercent at 100", () => {
    expect(usagePercent(def(), 101)).toBe(100);
    expect(usagePercent(def(), 9999)).toBe(100);
  });
  it("returns 0 percent when limit is 0 or negative", () => {
    expect(usagePercent(def({ limit: 0 }), 10)).toBe(0);
    expect(usagePercent(def({ limit: -1 }), 10)).toBe(0);
  });
  it("computes remainingPercent as complement", () => {
    expect(remainingPercent(def(), 0)).toBe(100);
    expect(remainingPercent(def(), 25)).toBe(75);
    expect(remainingPercent(def(), 100)).toBe(0);
    expect(remainingPercent(def(), 200)).toBe(0);
  });
});

describe("statusOf (threshold boundaries)", () => {
  const w = CONFIG.thresholds.warning;
  const e = CONFIG.thresholds.exhausted;
  it("is ok below the warning threshold", () => {
    expect(statusOf(def(), 0)).toBe("ok");
    expect(statusOf(def(), w - 1)).toBe("ok");
  });
  it("is warning at and above the warning threshold, below exhausted", () => {
    expect(statusOf(def(), w)).toBe("warning");
    expect(statusOf(def(), e - 1)).toBe("warning");
  });
  it("is exhausted at and above the exhausted threshold", () => {
    expect(statusOf(def(), e)).toBe("exhausted");
    expect(statusOf(def(), e + 50)).toBe("exhausted");
  });
  it("is ok when limit is 0", () => {
    expect(statusOf(def({ limit: 0 }), 10)).toBe("ok");
  });
});

describe("labels", () => {
  it("returns configured labels", () => {
    expect(statusLabel("ok")).toBe(CONFIG.statusLabels.ok);
    expect(statusLabel("warning")).toBe(CONFIG.statusLabels.warning);
    expect(statusLabel("exhausted")).toBe(CONFIG.statusLabels.exhausted);
    expect(kindLabel("video")).toBe(CONFIG.kindLabels.video);
    expect(kindLabel("local")).toBe(CONFIG.kindLabels.local);
    expect(cycleLabel("daily")).toBe(CONFIG.cycleLabels.daily);
    expect(cycleLabel("weekly")).toBe(CONFIG.cycleLabels.weekly);
    expect(cycleLabel("monthly")).toBe(CONFIG.cycleLabels.monthly);
    expect(cycleLabel("5hour")).toBe(CONFIG.cycleLabels["5hour"]);
  });
  it("falls back to the key itself for unknown values", () => {
    expect(statusLabel("mystery" as never)).toBe("mystery");
    expect(kindLabel("mystery" as never)).toBe("mystery");
    expect(cycleLabel("mystery" as never)).toBe("mystery");
  });
});

describe("findService", () => {
  it("finds a known service", () => {
    expect(findService(CATALOG[0].id)?.id).toBe(CATALOG[0].id);
  });
  it("returns undefined for unknown id", () => {
    expect(findService("does-not-exist")).toBeUndefined();
    expect(findService("")).toBeUndefined();
  });
});

describe("parseUsageInput", () => {
  it("parses numeric input", () => {
    expect(parseUsageInput("42")).toBe(42);
    expect(parseUsageInput(" 12 ")).toBe(12);
    expect(parseUsageInput("3.5")).toBe(3.5);
    expect(parseUsageInput("0")).toBe(0);
  });
  it("returns 0 for empty or whitespace input", () => {
    expect(parseUsageInput("")).toBe(0);
    expect(parseUsageInput("   ")).toBe(0);
  });
  it("returns 0 for non-numeric or non-finite input", () => {
    expect(parseUsageInput("abc")).toBe(0);
    expect(parseUsageInput("Infinity")).toBe(0);
    expect(parseUsageInput("12abc")).toBe(0);
  });
  it("normalizes negative input to 0", () => {
    expect(parseUsageInput("-5")).toBe(0);
  });
});

describe("nextReset", () => {
  it("daily: next day at 00:00", () => {
    const now = new Date(2026, 0, 15, 13, 45, 30);
    expect(nextReset("daily", now)).toEqual(new Date(2026, 0, 16, 0, 0, 0, 0));
  });
  it("daily: month-end rolls to the 1st of next month", () => {
    const now = new Date(2026, 0, 31, 23, 59);
    expect(nextReset("daily", now)).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
  });
  it("daily: exactly midnight still goes to the next day", () => {
    const now = new Date(2026, 0, 15, 0, 0, 0, 0);
    expect(nextReset("daily", now)).toEqual(new Date(2026, 0, 16, 0, 0, 0, 0));
  });
  it("weekly: Monday goes to the Monday 7 days later", () => {
    const monday = new Date(2026, 10, 16, 10, 0);
    expect(monday.getDay()).toBe(1);
    expect(nextReset("weekly", monday)).toEqual(new Date(2026, 10, 23, 0, 0, 0, 0));
  });
  it("weekly: Wednesday goes to the next Monday", () => {
    const wed = new Date(2026, 10, 18, 10, 0);
    expect(wed.getDay()).toBe(3);
    expect(nextReset("weekly", wed)).toEqual(new Date(2026, 10, 23, 0, 0, 0, 0));
  });
  it("weekly: Sunday goes to the next day (Monday)", () => {
    const sun = new Date(2026, 10, 22, 10, 0);
    expect(sun.getDay()).toBe(0);
    expect(nextReset("weekly", sun)).toEqual(new Date(2026, 10, 23, 0, 0, 0, 0));
  });
  it("weekly: Saturday goes to the Monday 2 days later", () => {
    const sat = new Date(2026, 10, 21, 10, 0);
    expect(sat.getDay()).toBe(6);
    expect(nextReset("weekly", sat)).toEqual(new Date(2026, 10, 23, 0, 0, 0, 0));
  });
  it("monthly: goes to the 1st of next month", () => {
    const now = new Date(2026, 0, 31, 12, 0);
    expect(nextReset("monthly", now)).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0));
  });
  it("monthly: December rolls to January of next year", () => {
    const now = new Date(2026, 11, 15, 12, 0);
    expect(nextReset("monthly", now)).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
  });
  it("monthly: the 1st still goes to next month's 1st", () => {
    const now = new Date(2026, 4, 1, 0, 0);
    expect(nextReset("monthly", now)).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
  });
  it("5hour: goes to the next 5-hour boundary", () => {
    expect(nextReset("5hour", new Date(2026, 0, 15, 3, 30))).toEqual(new Date(2026, 0, 15, 5, 0, 0, 0));
    expect(nextReset("5hour", new Date(2026, 0, 15, 0, 0))).toEqual(new Date(2026, 0, 15, 5, 0, 0, 0));
    expect(nextReset("5hour", new Date(2026, 0, 15, 9, 59))).toEqual(new Date(2026, 0, 15, 10, 0, 0, 0));
    expect(nextReset("5hour", new Date(2026, 0, 15, 14, 0))).toEqual(new Date(2026, 0, 15, 15, 0, 0, 0));
    expect(nextReset("5hour", new Date(2026, 0, 15, 19, 30))).toEqual(new Date(2026, 0, 15, 20, 0, 0, 0));
  });
  it("5hour: an exact boundary goes to the following boundary", () => {
    expect(nextReset("5hour", new Date(2026, 0, 15, 5, 0))).toEqual(new Date(2026, 0, 15, 10, 0, 0, 0));
    expect(nextReset("5hour", new Date(2026, 0, 15, 20, 0))).toEqual(new Date(2026, 0, 16, 1, 0, 0, 0));
  });
  it("5hour: late evening rolls into the next day", () => {
    expect(nextReset("5hour", new Date(2026, 0, 15, 23, 59))).toEqual(new Date(2026, 0, 16, 1, 0, 0, 0));
    expect(nextReset("5hour", new Date(2026, 0, 15, 21, 0))).toEqual(new Date(2026, 0, 16, 1, 0, 0, 0));
  });
  it("does not mutate the input date", () => {
    const now = new Date(2026, 0, 15, 13, 0);
    const before = now.getTime();
    nextReset("daily", now);
    nextReset("weekly", now);
    nextReset("monthly", now);
    nextReset("5hour", now);
    expect(now.getTime()).toBe(before);
  });
  it("uses the current time by default", () => {
    const r = nextReset("daily");
    expect(r).toBeInstanceOf(Date);
    expect(r.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("summarize", () => {
  it("summarizes the default catalog with no usage", () => {
    const s = summarize({});
    expect(s.count).toBe(CATALOG.length);
    expect(s.used).toBe(0);
    expect(s.limit).toBe(CATALOG.reduce((a, x) => a + x.limit, 0));
    expect(s.exhausted).toBe(0);
  });
  it("counts exhausted services and totals usage", () => {
    const usage: Record<string, number> = {};
    for (const s of CATALOG) usage[s.id] = s.limit;
    const s = summarize(usage);
    expect(s.used).toBe(s.limit);
    expect(s.exhausted).toBe(CATALOG.length);
  });
  it("works with a custom catalog and partial usage", () => {
    const cat = [def({ id: "a", limit: 10 }), def({ id: "b", limit: 20 })];
    expect(summarize({ a: 10 }, cat)).toEqual({ count: 2, used: 10, limit: 30, exhausted: 1 });
    expect(summarize({ a: -5, b: "x" as never }, cat)).toEqual({ count: 2, used: 0, limit: 30, exhausted: 0 });
    expect(summarize({}, [])).toEqual({ count: 0, used: 0, limit: 0, exhausted: 0 });
  });
});

describe("filterServices", () => {
  const list = [
    def({ id: "a", name: "Runway", kind: "video" }),
    def({ id: "b", name: "runway mini", kind: "local" }),
    def({ id: "c", name: "Codex", kind: "local" }),
  ];
  it("returns all for empty query and kind=all", () => {
    expect(filterServices(list, "", "all")).toHaveLength(3);
    expect(filterServices(list, "   ", "all")).toHaveLength(3);
  });
  it("filters by kind", () => {
    expect(filterServices(list, "", "video").map((s) => s.id)).toEqual(["a"]);
    expect(filterServices(list, "", "local").map((s) => s.id)).toEqual(["b", "c"]);
  });
  it("filters by case-insensitive substring of the name", () => {
    expect(filterServices(list, "RUNWAY", "all").map((s) => s.id)).toEqual(["a", "b"]);
    expect(filterServices(list, " codex ", "all").map((s) => s.id)).toEqual(["c"]);
  });
  it("combines kind and query, and can return empty", () => {
    expect(filterServices(list, "runway", "local").map((s) => s.id)).toEqual(["b"]);
    expect(filterServices(list, "zzz", "all")).toEqual([]);
    expect(filterServices(list, "codex", "video")).toEqual([]);
    expect(filterServices([], "", "all")).toEqual([]);
  });
});

describe("buildStatus", () => {
  it("builds a full status with an explicit clock", () => {
    const now = new Date(2026, 0, 15, 3, 30);
    const st = buildStatus(def({ cycle: "5hour" }), 30, now);
    expect(st).toEqual({
      serviceId: "x",
      used: 30,
      remaining: 70,
      usagePercent: 30,
      remainingPercent: 70,
      status: "ok",
      statusLabel: CONFIG.statusLabels.ok,
      nextReset: new Date(2026, 0, 15, 5, 0).toISOString(),
    });
  });
  it("normalizes invalid usage and uses the current time by default", () => {
    const st = buildStatus(def(), "x");
    expect(st.used).toBe(0);
    expect(st.status).toBe("ok");
    expect(new Date(st.nextReset).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("loadUsage / saveUsage", () => {
  const mem = (initial: Record<string, string> = {}) => {
    const store = { ...initial };
    return {
      store,
      getItem: vi.fn((k: string) => (k in store ? store[k] : null)),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v;
      }),
    };
  };
  it("returns {} for null storage", () => {
    expect(loadUsage(null)).toEqual({});
  });
  it("returns {} when nothing is stored", () => {
    expect(loadUsage(mem())).toEqual({});
  });
  it("returns {} when getItem throws", () => {
    const s = { getItem: () => { throw new Error("boom"); }, setItem: () => undefined };
    expect(loadUsage(s)).toEqual({});
  });
  it("returns {} for invalid JSON", () => {
    expect(loadUsage(mem({ [CONFIG.storageKey]: "{oops" }))).toEqual({});
  });
  it("returns {} for non-object JSON values", () => {
    expect(loadUsage(mem({ [CONFIG.storageKey]: "null" }))).toEqual({});
    expect(loadUsage(mem({ [CONFIG.storageKey]: "\"str\"" }))).toEqual({});
    expect(loadUsage(mem({ [CONFIG.storageKey]: "123" }))).toEqual({});
    expect(loadUsage(mem({ [CONFIG.storageKey]: "[1,2]" }))).toEqual({});
    expect(loadUsage(mem({ [CONFIG.storageKey]: "true" }))).toEqual({});
  });
  it("loads and normalizes stored values", () => {
    const raw = JSON.stringify({ a: 5, b: "x", c: -3, d: 2.5 });
    expect(loadUsage(mem({ [CONFIG.storageKey]: raw }))).toEqual({ a: 5, b: 0, c: 0, d: 2.5 });
    expect(loadUsage(mem({ [CONFIG.storageKey]: "{}" }))).toEqual({});
  });
  it("uses the provided key", () => {
    const s = mem({ custom: JSON.stringify({ a: 1 }) });
    expect(loadUsage(s, "custom")).toEqual({ a: 1 });
    expect(s.getItem).toHaveBeenCalledWith("custom");
  });
  it("saveUsage returns false for null storage", () => {
    expect(saveUsage(null, {})).toBe(false);
  });
  it("saveUsage writes JSON under the default key", () => {
    const s = mem();
    expect(saveUsage(s, { a: 1 })).toBe(true);
    expect(s.setItem).toHaveBeenCalledWith(CONFIG.storageKey, JSON.stringify({ a: 1 }));
    expect(loadUsage(s)).toEqual({ a: 1 });
  });
  it("saveUsage writes under a custom key and returns false when setItem throws", () => {
    const s = mem();
    expect(saveUsage(s, { b: 2 }, "custom")).toBe(true);
    expect(s.setItem).toHaveBeenCalledWith("custom", JSON.stringify({ b: 2 }));
    const bad = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(saveUsage(bad, { a: 1 })).toBe(false);
  });
});
