# ブックマーク由来サービス（Crano / Viyou / Civitai / Mage / Colab）

対象ブランチ: `feature/bookmark-services`
調査日: 2026-11-19

## 1. 概要

ユーザーのブラウザブックマークにあった5サービスをカタログに追加した（サービス総数 13 → 18）。あわせて、画像中心のサービス（Civitai / Mage）のために新しい kind **`image`（画像生成）** を追加した（`ServiceKind`、`CONFIG.kindLabels` / `sectionLabels` / `filterLabels`、ダッシュボードのフィルタ、`/api/catalog` の kind 検証、`ImageQuotaSection` コンポーネントまで一貫対応）。

| サービスID | 名称 | kind | 上限 | 単位 | 周期 | 無料枠の検証状態 |
|---|---|---|---|---|---|---|
| `crano` | Crano AI | video | 100 | %(無料枠・額非公開) | daily | 存在は公式確認・**額は非公開** |
| `viyou` | Viyou | video | 200 | Coins(初回) | monthly | **公式pricingで確認** |
| `civitai` | Civitai | image | 100 | %(Blue Buzz・額非公開) | daily | 仕組みは公式確認・**固定額は非公開** |
| `mage` | Mage | image | 300 | Gems(初回) | monthly | 公式pricing由来（下記注記） |
| `colab` | Google Colab | gpu | 100 | %(無料GPU・上限非公開) | daily | 存在は公式確認・**上限は非公開（公式方針）** |

表記ルール（既存踏襲）:

- 数値の上限は、公式ソースで実際に読めた額だけを入れる。額が非公開のものは Codex / Antigravity と同じ **%スタイル（limit 100、手入力）** で表し、単位とメモに「非公開」と明記する。
- `limit 0` は「無料枠そのものが存在しない」場合専用（Luma / Pika）。無料枠が存在するのに額が非公開なケースでは使わない。

## 2. Crano AI（crano.ai）

- 種別: 動画＋画像＋音楽のオールインワン生成。ブックマーク名・公式サイトのタイトルとも動画が先頭のため kind は `video`（画像・音楽も可、とメモに明記）。
- **無料枠 [公式]:** 公式ツールページの FAQ に「free credits to get started, plus daily check-in credits」と明記され、無料クレジットとデイリーチェックインの存在は公式確認できる。出典: https://crano.ai/nsfw-ai-video-generator-and-editor
- **額は非公開 [公式]:** 公式 pricing（https://crano.ai/pricing 、2026-11-19 閲覧）には有料プラン（Lite 350 credits/月、Pro 800 credits/月、Premium 5,000 credits/月）しか載っておらず、無料クレジット・チェックイン報酬の額は記載がない。二次レビューも全て「額は非公開」で一致。
- カタログ表現: 額が分からない以上、%手入力（daily = チェックインの日次性に対応）とした。
- 後日の確認方法: 使用量を返す公開 API はなし。**ブラウザのみ**（ログイン後の残高表示を目視し、カードに % で手入力）。

## 3. Viyou（viyou.ai）

- 種別: 画像→動画（AI Kissing 等のエフェクト動画）が看板で、公式 pricing のタイトルも「AI Video & Image Generator」。kind は `video`（画像生成も可、とメモに明記）。
- **無料枠 [公式]:** 公式 pricing（https://viyou.ai/pricing 、2026-11-19 閲覧）の Starter（Free）プランに **「200 Coins / Lifetime」** と明記。生涯で200 Coins の初回付与のみで、定期補充ではない。
- 追加の無料獲得 [公式]: 公式ツールページに「free daily coins」「daily check-in で無料クレジット」とあり、デイリーチェックインでも Coins を獲得できるが、その**額は公式ページに明記がない**（二次情報では 60–180 Coins との報告があるが未検証のためカタログには入れない）。
- カタログ表現: Runway / Hailuo と同じ「初回のみ」型 — limit 200、単位 `Coins(初回)`、cycle は便宜上 monthly。
- 後日の確認方法: 公開 API はなし。**ブラウザのみ**（残高はログイン後に確認）。

## 4. Civitai（civitai.com）

- 種別: AI アートのモデル共有＋オンライン生成プラットフォーム。生成の中心は画像のため kind は新規 `image`。
- **無料枠 [公式]:** 無料通貨は **Blue Buzz**。固定の付与額は **unpublished** で、日次報酬＋コミュニティ行動（リアクション、投稿、広告視聴等）で得る。報酬一覧と上限は「随時変わる」もので、ログイン後の Buzz Dashboard にのみ掲載。日次報酬は **00:00 UTC リセット**（獲得した Blue Buzz 自体は蓄積され消えない）。出典: https://education.civitai.com/buzz-colors-blue-yellow-and-green/ / https://education.civitai.com/civitais-guide-to-membership-tiers/
- [コミュニティ報告] 新規登録時に 100 Blue Buzz、という報告があるが公式の固定額ではないためカタログには入れない。
- カタログ表現: 残高は蓄積型で「上限」概念がなく、固定額も非公開のため %手入力（daily = 日次報酬のリセットに対応）とした。
- 後日の確認方法: **残高だけは API 相当で取得可**。開発者 docs 明記: `GET /api/v1/me` は残高を返さない代わりに、tRPC の **`buzz.getUserAccount`**（要 `BuzzRead` スコープ）で読む。アプリ向けには `GET /api/v1/blocks/buzz`（`buzz:read:self`）が `{blue, green, yellow}` を返す。出典: https://developer.civitai.com/site/oauth/buzz-limits 。ただし「日次付与額」ではなく「現在残高」しか取れない点に注意。

## 5. Mage（mage.space）

- 種別: オープンモデル中心の画像生成が本業（旧来は無制限の無料画像生成で知られた）。動画・キャラクター生成もあるが、無料アカウントでは大半の動画モデルにアクセスできないため kind は新規 `image`。
- **無料枠 [公式 pricing 由来]:** 登録時に **300 Gems（初回のみ・補充なし）**。付与された Gems は90日で失効（公式ドキュメントの記述として複数レビューが引用）。旧来の無制限無料枠は廃止済みで、無制限生成は有料メンバーシップ（Basic $10/月〜）の機能。出典: https://www.mage.space/membership
- 注記: 本調査セッションでは mage.space ドメインへの直接フェッチがツール側ポリシーでブロックされ、公式ページそのものは開けなかった。上記数値は「公式 pricing ページから取得」と明記する複数の独立レビュー（2026-09-30 に公式ページで再検証した記録を含む）で完全に一致しているため採用したが、厳密には**公式ページの直接確認は未了**。次回ブラウザで mage.space を開く機会に目視確認すること。
- カタログ表現: Runway 型の「初回のみ」— limit 300、単位 `Gems(初回)`、cycle は便宜上 monthly。
- 後日の確認方法: 公開 API はなし（プレミアム API は限定ベータとの情報のみ）。**ブラウザのみ**。

## 6. Google Colab（colab.research.google.com）

- 種別: 無料 GPU/TPU ノートブック。kind は `gpu`。
- **無料枠 [公式]:** 無料の GPU/TPU アクセスはあるが、**金額・上限は unpublished/unclear（設計上非公開）**。公式 FAQ「Colab does not publish these limits」と明言し、制限・GPU 種別・アイドルタイムアウトは変動する。無料ノートブックは最大12時間。無料プランにコンピュートユニットはない（有料専用）。出典: https://research.google.com/colaboratory/faq.html
- カタログ表現: 上限もリセット周期も公式非公開のため、%手入力とし、cycle は便宜上の daily 登録であることをメモに明記した（Kaggle のような「週30時間」という数値は存在しない）。
- 後日の確認方法: 無料使用量・残高を返す公式 API は**なし**。**ブラウザのみ**（Colab UI 内の使用状況表示）。

## 7. テスト

- `tests/catalog.test.ts`: kind ラベル集合（image 追加）、セクションタイトル（画像生成サービス）、カタログ総数 18 件、新規5サービスの表現を検証するテストを追加。
- `tests/quota.test.ts`: `kindLabel("image")` の解決を検証。
- 対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% を維持。
