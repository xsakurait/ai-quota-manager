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
  windowLabels: { 300: "5時間", 1440: "日次", 10080: "週間", 43200: "月間" } as Record<number, string>,
  windowMinuteUnit: "分",
  liveLabels: { title: "ライブ", stale: "古い可能性" },
  dashboardLinkLabel: "使用量ページを開く",
  thresholds: { warning: 70, exhausted: 100 },
  statusLabels: { ok: "通常", warning: "注意", exhausted: "枯渇" } as Record<Status, string>,
  kindLabels: { video: "動画生成", image: "画像生成", local: "ローカル", gpu: "GPU", voice: "音声生成" } as Record<ServiceKind, string>,
  sectionLabels: {
    video: "動画生成サービス",
    image: "画像生成サービス",
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
  filterLabels: { all: "すべて", video: "動画生成", image: "画像生成", local: "ローカル", gpu: "GPU", voice: "音声生成" } as Record<
    "all" | ServiceKind,
    string
  >,
} as const;

export const CATALOG: ServiceDef[] = [
  { id: "runway", name: "Runway", kind: "video", limit: 125, unit: "credits(初回)", cycle: "monthly", dashboardUrl: "https://app.runwayml.com", note: "無料プランの初期クレジット目安" },
  { id: "kling", name: "Kling AI", kind: "video", limit: 66, unit: "credits/月(Trial)", cycle: "monthly", dashboardUrl: "https://kling.ai/app/membership/membership-plan", note: "日次付与は加入者限定。非加入者は月次Trial(額は公式非公開、66は報告ベースの目安・要実確認)" },
  { id: "luma", name: "Luma Dream Machine", kind: "video", limit: 0, unit: "トライアル(額非公開)", cycle: "monthly", dashboardUrl: "https://lumalabs.ai/dream-machine", note: "現行pricingに無料プランなし。トライアル額は非公開のため0で登録" },
  { id: "hailuo", name: "Hailuo (MiniMax)", kind: "video", limit: 150, unit: "credits(初回)", cycle: "monthly", dashboardUrl: "https://hailuoai.video/subscribe", note: "初回ウェルカムパックは額非公開(報告約150の目安)。3日で失効" },
  { id: "pixverse", name: "PixVerse", kind: "video", limit: 30, unit: "credits/日", cycle: "daily", dashboardUrl: "https://app.pixverse.ai/subscribe", note: "初回60クレジット+毎日30クレジット(二次情報ベース・要実確認)" },
  { id: "pika", name: "Pika", kind: "video", limit: 0, unit: "credits/月", cycle: "monthly", dashboardUrl: "https://pika.art/", note: "実質無料生成なし(0クレジット/月、パック購入制)" },
  { id: "crano", name: "Crano AI", kind: "video", limit: 100, unit: "%(無料枠・額非公開)", cycle: "daily", dashboardUrl: "https://crano.ai/", note: "公式FAQ: 無料クレジット+デイリーチェックインあり。ただし額は公式pricingにも非公開のため%手入力で管理。画像・音楽生成も可" },
  { id: "viyou", name: "Viyou", kind: "video", limit: 200, unit: "Coins(初回)", cycle: "monthly", dashboardUrl: "https://viyou.ai/", note: "公式pricing: Starter無料は200 Coins(生涯・初回のみ)。デイリーチェックインでもCoins獲得可(額は非公開)。画像生成も可" },
  { id: "civitai", name: "Civitai", kind: "image", limit: 100, unit: "%(Blue Buzz・額非公開)", cycle: "daily", dashboardUrl: "https://civitai.com/", note: "無料通貨Blue Buzzは日次報酬(00:00 UTCリセット)+コミュニティ行動で獲得。固定額は公式非公開・残高は蓄積型のため%手入力で管理。残高はtRPC buzz.getUserAccountで取得可" },
  { id: "mage", name: "Mage", kind: "image", limit: 300, unit: "Gems(初回)", cycle: "monthly", dashboardUrl: "https://www.mage.space/", note: "登録時に300 Gems(初回のみ・付与から90日で失効)。旧来の無制限無料枠は廃止済み。動画・キャラクター生成も可(無料枠は主に画像)" },
  { id: "codex", name: "Codex (ローカル)", kind: "local", limit: 100, unit: "%/5時間枠", cycle: "5hour", dashboardUrl: "https://chatgpt.com/codex/settings/usage", note: "使用率は手入力。週間枠はメモ欄で管理" },
  { id: "antigravity", name: "Antigravity (ローカル)", kind: "local", limit: 100, unit: "%/週枠", cycle: "weekly", note: "使用率は手入力" },
  { id: "cursor", name: "Cursor (ローカル)", kind: "local", limit: 100, unit: "%(included usage・上限非公開)", cycle: "weekly", dashboardUrl: "https://cursor.com/dashboard", note: "Freeプランの included usage をダッシュボード表示の%で管理。具体的な上限値(リクエスト数等)は非公開。リセット日はダッシュボード表示が正(確認時: 2026-11-21)。確認はブラウザのダッシュボードのみ(公開APIなし)" },
  { id: "muse", name: "Muse", kind: "local", limit: 100, unit: "%/枠", cycle: "monthly", note: "クラウド管理のため手入力。アカウント追加はこの accounts に1件足すだけ（docs/09 参照）", accounts: [{ id: "primary", label: "メイン" }] },
  { id: "kaggle", name: "Kaggle GPU", kind: "gpu", limit: 30, unit: "時間/週", cycle: "weekly", dashboardUrl: "https://www.kaggle.com/settings", note: "GPU 30時間/週 (公式MCP get_accelerator_quota で取得可)" },
  { id: "kaggle-tpu", name: "Kaggle TPU", kind: "gpu", limit: 20, unit: "時間/週", cycle: "weekly", dashboardUrl: "https://www.kaggle.com/settings", note: "TPU 最大20時間/週" },
  { id: "modal", name: "Modal", kind: "gpu", limit: 30, unit: "USD/月", cycle: "monthly", dashboardUrl: "https://modal.com/settings", note: "Starter $30/月の無料クレジット。billing APIはTeam/Enterprise向けのためStarterはダッシュボード確認が基本" },
  { id: "colab", name: "Google Colab", kind: "gpu", limit: 100, unit: "%(無料GPU・上限非公開)", cycle: "daily", dashboardUrl: "https://colab.research.google.com/", note: "無料GPU/TPUあり。公式FAQが上限の非公開を明言(動的制限・GPU種別も変動)のため%手入力で管理。リセット周期も公式非公開で便宜上の登録。取得APIなし・ブラウザ確認のみ" },
  { id: "elevenlabs", name: "ElevenLabs", kind: "voice", limit: 10000, unit: "credits/月", cycle: "monthly", dashboardUrl: "https://elevenlabs.io/app/subscription", note: "無料プラン 10,000クレジット/月 (subscription APIで取得可)" },
];
