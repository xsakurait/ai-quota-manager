import type { ResetCycle, ServiceDef, ServiceKind, Status } from "../types";

/**
 * Single source of truth for every service definition, limit, unit,
 * reset cycle, threshold, label, storage key and env key name.
 * No other file may hardcode these values.
 */
export const ENV_KEYS = {
  appName: "NEXT_PUBLIC_APP_NAME",
  storageKey: "QUOTA_STORAGE_KEY",
} as const;

export const CONFIG = {
  appName: process.env[ENV_KEYS.appName] ?? "無料枠管理アプリ",
  storageKey: process.env[ENV_KEYS.storageKey] ?? "ai-quota-usage-v1",
  thresholds: { warning: 70, exhausted: 100 },
  statusLabels: { ok: "通常", warning: "注意", exhausted: "枯渇" } as Record<Status, string>,
  kindLabels: { video: "動画生成", local: "ローカル" } as Record<ServiceKind, string>,
  cycleLabels: {
    daily: "毎日リセット",
    weekly: "毎週リセット",
    monthly: "毎月リセット",
    "5hour": "5時間枠",
  } as Record<ResetCycle, string>,
  filterLabels: { all: "すべて", video: "動画生成", local: "ローカル" } as Record<
    "all" | ServiceKind,
    string
  >,
} as const;

export const CATALOG: ServiceDef[] = [
  { id: "runway", name: "Runway", kind: "video", limit: 125, unit: "credits(初回)", cycle: "monthly", note: "無料プランの初期クレジット目安" },
  { id: "kling", name: "Kling AI", kind: "video", limit: 66, unit: "credits/日", cycle: "daily", note: "ログインで日次付与の目安" },
  { id: "luma", name: "Luma Dream Machine", kind: "video", limit: 30, unit: "生成/月", cycle: "monthly", note: "無料枠の目安" },
  { id: "hailuo", name: "Hailuo (MiniMax)", kind: "video", limit: 1000, unit: "credits(初回)", cycle: "monthly", note: "初期クレジット目安" },
  { id: "pixverse", name: "PixVerse", kind: "video", limit: 100, unit: "credits/日", cycle: "daily", note: "日次付与の目安" },
  { id: "pika", name: "Pika", kind: "video", limit: 80, unit: "credits/月", cycle: "monthly", note: "無料枠の目安" },
  { id: "codex", name: "Codex (ローカル)", kind: "local", limit: 100, unit: "%/5時間枠", cycle: "5hour", note: "使用率は手入力。週間枠はメモ欄で管理" },
  { id: "antigravity", name: "Antigravity (ローカル)", kind: "local", limit: 100, unit: "%/週枠", cycle: "weekly", note: "使用率は手入力" },
  { id: "muse", name: "Muse", kind: "local", limit: 100, unit: "%/枠", cycle: "monthly", note: "クラウド管理のため手入力" },
];
