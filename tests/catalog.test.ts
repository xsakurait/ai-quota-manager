import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, CONFIG, ENV_KEYS } from "../src/shared/config/catalog";

describe("catalog (single source of truth)", () => {
  it("defines env key names", () => {
    expect(ENV_KEYS.appName).toBe("NEXT_PUBLIC_APP_NAME");
    expect(ENV_KEYS.storageKey).toBe("QUOTA_STORAGE_KEY");
  });
  it("falls back to defaults when env vars are unset", () => {
    expect(CONFIG.appName).toBe("無料枠管理アプリ");
    expect(CONFIG.storageKey).toBe("ai-quota-usage-v1");
  });
  it("has ordered thresholds", () => {
    expect(CONFIG.thresholds.warning).toBeGreaterThan(0);
    expect(CONFIG.thresholds.warning).toBeLessThan(CONFIG.thresholds.exhausted);
    expect(CONFIG.thresholds.exhausted).toBeLessThanOrEqual(100);
  });
  it("has labels for every status, kind and cycle", () => {
    expect(Object.keys(CONFIG.statusLabels).sort()).toEqual(["exhausted", "ok", "warning"]);
    expect(Object.keys(CONFIG.kindLabels).sort()).toEqual(["local", "video"]);
    expect(Object.keys(CONFIG.cycleLabels).sort()).toEqual(["5hour", "daily", "monthly", "weekly"]);
    expect(Object.keys(CONFIG.filterLabels).sort()).toEqual(["all", "local", "video"]);
    for (const v of [
      ...Object.values(CONFIG.statusLabels),
      ...Object.values(CONFIG.kindLabels),
      ...Object.values(CONFIG.cycleLabels),
      ...Object.values(CONFIG.filterLabels),
    ]) {
      expect(v.length).toBeGreaterThan(0);
    }
  });
  it("catalog entries are well-formed with unique ids", () => {
    const ids = new Set<string>();
    expect(CATALOG.length).toBeGreaterThan(0);
    for (const s of CATALOG) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(s.name.length).toBeGreaterThan(0);
      expect(["video", "local"]).toContain(s.kind);
      expect(s.limit).toBeGreaterThan(0);
      expect(s.unit.length).toBeGreaterThan(0);
      expect(["daily", "weekly", "monthly", "5hour"]).toContain(s.cycle);
      expect(s.note.length).toBeGreaterThan(0);
    }
  });
  it("catalog covers both kinds and all reset cycles", () => {
    expect(new Set(CATALOG.map((s) => s.kind))).toEqual(new Set(["video", "local"]));
    expect(new Set(CATALOG.map((s) => s.cycle))).toEqual(new Set(["daily", "weekly", "monthly", "5hour"]));
  });
});

describe("catalog env overrides", () => {
  afterEach(() => {
    delete process.env[ENV_KEYS.appName];
    delete process.env[ENV_KEYS.storageKey];
    vi.resetModules();
  });
  it("uses env values when set", async () => {
    process.env[ENV_KEYS.appName] = "Env App";
    process.env[ENV_KEYS.storageKey] = "env-key";
    vi.resetModules();
    const mod = await import("../src/shared/config/catalog");
    expect(mod.CONFIG.appName).toBe("Env App");
    expect(mod.CONFIG.storageKey).toBe("env-key");
  });
  it("mixes env values and fallbacks independently", async () => {
    process.env[ENV_KEYS.appName] = "Only Name";
    vi.resetModules();
    const mod = await import("../src/shared/config/catalog");
    expect(mod.CONFIG.appName).toBe("Only Name");
    expect(mod.CONFIG.storageKey).toBe("ai-quota-usage-v1");
  });
});
