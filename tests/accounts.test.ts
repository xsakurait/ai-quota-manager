import { describe, expect, it } from "vitest";
import { DEFAULT_ACCOUNT, getUsage, resolveAccounts, usageKey } from "../src/shared/lib/accounts";
import type { ServiceDef, UsageMap } from "../src/shared/types";

const def = (over: Partial<ServiceDef> = {}): ServiceDef => ({
  id: "x",
  name: "X Service",
  kind: "local",
  limit: 100,
  unit: "%",
  cycle: "monthly",
  note: "",
  ...over,
});

describe("usageKey", () => {
  it("returns the bare service id without an account", () => {
    expect(usageKey("muse")).toBe("muse");
    expect(usageKey("muse", undefined)).toBe("muse");
  });
  it("treats an empty account id as no account", () => {
    expect(usageKey("muse", "")).toBe("muse");
  });
  it("joins service and account ids with a colon", () => {
    expect(usageKey("muse", "primary")).toBe("muse:primary");
    expect(usageKey("codex", "work")).toBe("codex:work");
  });
});

describe("resolveAccounts", () => {
  it("returns the single implicit default account when accounts is undefined", () => {
    const accounts = resolveAccounts(def());
    expect(accounts).toEqual([DEFAULT_ACCOUNT]);
    expect(accounts[0].id).toBe("");
  });
  it("returns the default account when accounts is an empty array", () => {
    expect(resolveAccounts(def({ accounts: [] }))).toEqual([DEFAULT_ACCOUNT]);
  });
  it("returns the configured accounts as-is", () => {
    const configured = [
      { id: "primary", label: "メイン" },
      { id: "sub", label: "サブ" },
    ];
    expect(resolveAccounts(def({ accounts: configured }))).toEqual(configured);
  });
  it("exposes a blank default account definition", () => {
    expect(DEFAULT_ACCOUNT).toEqual({ id: "", label: "" });
  });
});

describe("getUsage", () => {
  const map: UsageMap = {
    muse: 30,
    "muse:primary": 55,
    "muse:sub": 0,
  };
  it("reads the bare key without an account", () => {
    expect(getUsage(map, "muse")).toBe(30);
    expect(getUsage(map, "muse", undefined)).toBe(30);
    expect(getUsage(map, "muse", "")).toBe(30);
  });
  it("reads the per-account key with an account", () => {
    expect(getUsage(map, "muse", "primary")).toBe(55);
    expect(getUsage(map, "muse", "sub")).toBe(0);
  });
  it("returns 0 for missing keys", () => {
    expect(getUsage(map, "unknown")).toBe(0);
    expect(getUsage(map, "muse", "unknown")).toBe(0);
    expect(getUsage({}, "muse")).toBe(0);
  });
  it("returns 0 for non-number and non-finite values", () => {
    const bad = {
      a: "10",
      b: Number.NaN,
      c: Number.POSITIVE_INFINITY,
      d: Number.NEGATIVE_INFINITY,
      e: null,
      f: true,
    } as unknown as UsageMap;
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      expect(getUsage(bad, id)).toBe(0);
    }
  });
  it("clamps negative values to 0 and keeps valid values", () => {
    expect(getUsage({ x: -5 }, "x")).toBe(0);
    expect(getUsage({ x: 0 }, "x")).toBe(0);
    expect(getUsage({ x: 12.5 }, "x")).toBe(12.5);
  });
});
