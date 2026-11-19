import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG, CONFIG, ENV_KEYS } from "../src/shared/config/catalog";

describe("catalog (single source of truth)", () => {
  it("defines env key names", () => {
    expect(ENV_KEYS.appName).toBe("NEXT_PUBLIC_APP_NAME");
    expect(ENV_KEYS.storageKey).toBe("QUOTA_STORAGE_KEY");
    expect(ENV_KEYS.readingsFile).toBe("READINGS_FILE");
  });
  it("falls back to defaults when env vars are unset", () => {
    expect(CONFIG.appName).toBe("無料枠管理アプリ");
    expect(CONFIG.storageKey).toBe("ai-quota-usage-v1");
    expect(CONFIG.readingsFile).toBe("./data/readings.json");
  });
  it("defines live reading labels, window labels and staleness", () => {
    expect(CONFIG.readingStaleHours).toBe(24);
    expect(CONFIG.windowLabels[300]).toBe("5時間");
    expect(CONFIG.windowLabels[10080]).toBe("週間");
    expect(CONFIG.windowLabels[43200]).toBe("月間");
    expect(CONFIG.windowMinuteUnit).toBe("分");
    expect(CONFIG.liveLabels.title).toBe("ライブ");
    expect(CONFIG.liveLabels.stale).toBe("古い可能性");
  });
  it("gives the muse service a primary account", () => {
    const muse = CATALOG.find((s) => s.id === "muse");
    expect(muse?.accounts).toEqual([{ id: "primary", label: "メイン" }]);
    for (const s of CATALOG) {
      if (s.id !== "muse") {
        expect(s.accounts).toBeUndefined();
      }
    }
  });
  it("has ordered thresholds", () => {
    expect(CONFIG.thresholds.warning).toBeGreaterThan(0);
    expect(CONFIG.thresholds.warning).toBeLessThan(CONFIG.thresholds.exhausted);
    expect(CONFIG.thresholds.exhausted).toBeLessThanOrEqual(100);
  });
  it("has labels for every status, kind and cycle", () => {
    expect(Object.keys(CONFIG.statusLabels).sort()).toEqual(["exhausted", "ok", "warning"]);
    expect(Object.keys(CONFIG.kindLabels).sort()).toEqual(["gpu", "local", "video", "voice"]);
    expect(Object.keys(CONFIG.sectionLabels).sort()).toEqual(["gpu", "local", "video", "voice"]);
    expect(Object.keys(CONFIG.cycleLabels).sort()).toEqual(["5hour", "daily", "monthly", "weekly"]);
    expect(Object.keys(CONFIG.filterLabels).sort()).toEqual(["all", "gpu", "local", "video", "voice"]);
    for (const v of [
      ...Object.values(CONFIG.statusLabels),
      ...Object.values(CONFIG.kindLabels),
      ...Object.values(CONFIG.sectionLabels),
      ...Object.values(CONFIG.cycleLabels),
      ...Object.values(CONFIG.filterLabels),
    ]) {
      expect(v.length).toBeGreaterThan(0);
    }
  });
  it("defines section titles per kind", () => {
    expect(CONFIG.sectionLabels.video).toBe("動画生成サービス");
    expect(CONFIG.sectionLabels.local).toBe("ローカルエージェント");
    expect(CONFIG.sectionLabels.gpu).toBe("GPUサービス");
    expect(CONFIG.sectionLabels.voice).toBe("音声生成サービス");
  });
  it("catalog entries are well-formed with unique ids", () => {
    const ids = new Set<string>();
    expect(CATALOG.length).toBeGreaterThan(0);
    for (const s of CATALOG) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(s.name.length).toBeGreaterThan(0);
      expect(["video", "local", "gpu", "voice"]).toContain(s.kind);
      expect(s.limit).toBeGreaterThanOrEqual(0); // 0 = no free tier (e.g. Luma/Pika), note must explain
      expect(s.unit.length).toBeGreaterThan(0);
      expect(["daily", "weekly", "monthly", "5hour"]).toContain(s.cycle);
      expect(s.note.length).toBeGreaterThan(0);
    }
  });
  it("catalog covers all kinds and all reset cycles", () => {
    expect(new Set(CATALOG.map((s) => s.kind))).toEqual(new Set(["video", "local", "gpu", "voice"]));
    expect(new Set(CATALOG.map((s) => s.cycle))).toEqual(new Set(["daily", "weekly", "monthly", "5hour"]));
  });
  it("has 13 services including Kaggle GPU/TPU, Modal and ElevenLabs", () => {
    expect(CATALOG.length).toBe(13);
    expect(CATALOG.find((s) => s.id === "kaggle")).toMatchObject({
      name: "Kaggle GPU",
      kind: "gpu",
      limit: 30,
      unit: "時間/週",
      cycle: "weekly",
    });
    expect(CATALOG.find((s) => s.id === "kaggle-tpu")).toMatchObject({
      name: "Kaggle TPU",
      kind: "gpu",
      limit: 20,
      unit: "時間/週",
      cycle: "weekly",
    });
    expect(CATALOG.find((s) => s.id === "modal")).toMatchObject({
      name: "Modal",
      kind: "gpu",
      limit: 30,
      unit: "USD/月",
      cycle: "monthly",
    });
    expect(CATALOG.find((s) => s.id === "elevenlabs")).toMatchObject({
      name: "ElevenLabs",
      kind: "voice",
      limit: 10000,
      unit: "credits/月",
      cycle: "monthly",
    });
  });
});

describe("catalog env overrides", () => {
  afterEach(() => {
    delete process.env[ENV_KEYS.appName];
    delete process.env[ENV_KEYS.storageKey];
    delete process.env[ENV_KEYS.readingsFile];
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
  it("uses the READINGS_FILE env value when set", async () => {
    process.env[ENV_KEYS.readingsFile] = "/tmp/custom-readings.json";
    vi.resetModules();
    const mod = await import("../src/shared/config/catalog");
    expect(mod.CONFIG.readingsFile).toBe("/tmp/custom-readings.json");
    expect(mod.CONFIG.appName).toBe("無料枠管理アプリ");
  });
});
