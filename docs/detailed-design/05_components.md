# 詳細設計書 05 コンポーネント

共通項目は `00_index-and-common.md` および基本設計 画面設計書を参照する。

## 共通UI（src/shared/ui/）
shadcn/ui スタイルで実装し、`class-variance-authority` / `clsx` / `tailwind-merge` / `@radix-ui/react-slot` を用いる。
| コンポーネント | 概要 |
|---|---|
| Button | variant（default/destructive/outline/secondary/ghost/link）と size を持つ。`asChild` で Slot 対応 |
| Card | Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter |
| Input | 標準のテキスト/数値入力スタイル |
| Badge | variant による状態色分け表示 |

## featureコンポーネント
| モジュール | コンポーネント | 役割 |
|---|---|---|
| dashboard | Dashboard | 一覧・検索・フィルタ・サマリ・保存を統括するクライアントコンポーネント |
| video-quota | ServiceCard（video） | 動画サービスのカード表示（Dashboardから種別で利用） |
| local-agent | ServiceCard（local） | ローカルサービスのカード表示。実装は shared のカード部品を共用し、featureはバレル経由で公開 |
| usage-record | UsageControls | +/- ボタンと直接入力 |

- ServiceCard は使用量・状態を受け取り表示に専念し、計算は shared/lib に委譲する。
- feature間の直接 import は行わず、Dashboard は各 feature のバレル（index.ts）経由でのみ参照する。ただし循環を避けるためカード実体は shared/ui のプリミティブと shared/lib のみで構成し、featureバレルが再公開する構成とする。
