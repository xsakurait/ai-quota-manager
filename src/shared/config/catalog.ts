import type { ResetCycle, ServiceDef, ServiceKind, Status } from "../types";

/**
 * Single source of truth for every service definition, limit, unit,
 * reset cycle, threshold, label, storage key and env key name.
 * No other file may hardcode these values.
 */
export const ENV_KEYS = {
  appName: "NEXT_PUBLIC_APP_NAME",
  storageKey: "QUOTA_STORAGE_KEY",
  readingsFile: "READINGS_FILE",
} as const;

export const CONFIG = {
  appName: process.env[ENV_KEYS.appName] ?? "無料枠管理アプリ",
  storageKey: process.env[ENV_KEYS.storageKey] ?? "ai-quota-usage-v1",
  readingsFile: process.env[ENV_KEYS.readingsFile] ?? "./data/readings.json",
  readingStaleHours: 24,
  windowLabels: { 300: "5時間", 10080: "週間", 43200: "月間" } as Record<number, string>,
  windowMinuteUnit: "分",
  liveLabels: { title: "ライブ", stale: "古い可能性" },
  thresholds: { warning: 70, exhausted: 100 },
  statusLabels: { ok: "通常", warning: "注意", exhausted: "枯渇" } as Record<Status, string>,
  kindLabels: { video: "動画生成", local: "ローカル", gpu: "GPU", voice: "音声生成" } as Record<ServiceKind, string>,
  sectionLabels: {
    video: "動画生成サービス",
    local: "ローカルエージェント",
    gpu: "GPUサービス",
    voice: "音声生成サービス",
  } as Record<ServiceKind, string>,
  cycleLabels: {
    daily: "毎日リセット",
    weekly: "毎週リセット",
    monthly: "毎月リセット",
    "5hour": "5時間枠",
  } as Record<ResetCycle, string>,
  filterLabels: { all: "すべて", video: "動画生成", local: "ローカル", gpu: "GPU", voice: "音声生成" } as Record<
    "all" | ServiceKind,
    string
  >,
} as const;

export const CATALOG: ServiceDef[] = [
  { id: "runway", name: "Runway", kind: "video", limit: 125, unit: "credits(初回)", cycle: "monthly", note: "無料プランの初期クレジット目安" },
  { id: "kling", name: "Kling AI", kind: "video", limit: 66, unit: "credits/月(Trial)", cycle: "monthly", note: "日次付与は加入者限定。非加入者は月次Trial(額は公式非公開、66は報告ベースの目安・要実確認)" },
  { id: "luma", name: "Luma Dream Machine", kind: "video", limit: 0, unit: "トライアル(額非公開)", cycle: "monthly", note: "現行pricingに無料プランなし。トライアル額は非公開のため0で登録" },
  { id: "hailuo", name: "Hailuo (MiniMax)", kind: "video", limit: 150, unit: "credits(初回)", cycle: "monthly", note: "初回ウェルカムパックは額非公開(報告約150の目安)。3日で失効" },
  { id: "pixverse", name: "PixVerse", kind: "video", limit: 30, unit: "credits/日", cycle: "daily", note: "初回60クレジット+毎日30クレジット(二次情報ベース・要実確認)" },
  { id: "pika", name: "Pika", kind: "video", limit: 0, unit: "credits/月", cycle: "monthly", note: "実質無料生成なし(0クレジット/月、パック購入制)" },
  { id: "codex", name: "Codex (ローカル)", kind: "local", limit: 100, unit: "%/5時間枠", cycle: "5hour", note: "使用率は手入力。週間枠はメモ欄で管理" },
  { id: "antigravity", name: "Antigravity (ローカル)", kind: "local", limit: 100, unit: "%/週枠", cycle: "weekly", note: "使用率は手入力" },
  { id: "muse", name: "Muse", kind: "local", limit: 100, unit: "%/枠", cycle: "monthly", note: "クラウド管理のため手入力。アカウント追加はこの accounts に1件足すだけ（docs/09 参照）", accounts: [{ id: "primary", label: "メイン" }] },
  { id: "kaggle", name: "Kaggle GPU", kind: "gpu", limit: 30, unit: "時間/週", cycle: "weekly", note: "GPU 30時間/週 (公式MCP get_accelerator_quota で取得可)" },
  { id: "kaggle-tpu", name: "Kaggle TPU", kind: "gpu", limit: 20, unit: "時間/週", cycle: "weekly", note: "TPU 最大20時間/週" },
  { id: "modal", name: "Modal", kind: "gpu", limit: 30, unit: "USD/月", cycle: "monthly", note: "Starter $30/月の無料クレジット。billing APIはTeam/Enterprise向けのためStarterはダッシュボード確認が基本" },
  { id: "elevenlabs", name: "ElevenLabs", kind: "voice", limit: 10000, unit: "credits/月", cycle: "monthly", note: "無料プラン 10,000クレジット/月 (subscription APIで取得可)" },
];
