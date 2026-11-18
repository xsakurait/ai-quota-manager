# 基本設計書 アーキテクチャ

共通項目は `00_common.md` を参照する。本書では値を複写しない。

## 1. 技術構成
| 層 | 技術 | 役割 |
|---|---|---|
| フレームワーク | Next.js (App Router, TypeScript) | 画面描画・ルーティング |
| API | Hono | `src/app/api/[[...route]]/route.ts` から公開する参照・検証API |
| UI | shadcn/ui スタイル共通コンポーネント | `src/shared/ui/` の Button/Card/Input/Badge |
| 状態保存 | localStorage | 使用量の永続化（C-5参照） |
| テスト | Vitest + coverage-v8 | 純粋ロジックの単体テスト |

## 2. ディレクトリ構成
```
src/
  app/            画面エントリとAPIルート
  features/
    video-quota/    動画サービス向け表示部品（index.ts バレル公開）
    local-agent/    ローカルエージェント向け表示部品
    dashboard/      ダッシュボード集約表示
    usage-record/   使用量入力部品
  shared/
    config/         単一の情報源（C-2）
    lib/            純粋ロジック（quota.ts, cn.ts）
    ui/             shadcn/ui スタイル共通UI
    types.ts        共通型
```

## 3. 依存ルール
- feature間の直接 import を禁止する。featureは `src/shared/` のみを参照する。
- featureの公開は各 `index.ts` バレル経由に限定する。
- 計算ロジックは画面・APIの双方から `src/shared/lib/quota.ts` を再利用する（N2）。
