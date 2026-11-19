# Kaggle / ElevenLabs の追加（GPU・音声セクション）

対象ブランチ: `feature/kaggle-elevenlabs`

## 1. 概要

サービス種別（kind）に `gpu` と `voice` を追加し、ダッシュボードに「GPUサービス」「音声生成サービス」セクションを新設した。追加サービスは次の3件（定義は従来どおり `src/shared/config/catalog.ts` のみが正。セクション見出しも `CONFIG.sectionLabels` に集約し、コンポーネントに直書きしない）：

| サービスID | 名称 | kind | 上限 | 単位 | 周期 |
|---|---|---|---|---|---|
| `kaggle` | Kaggle GPU | gpu | 30 | 時間/週 | weekly |
| `kaggle-tpu` | Kaggle TPU | gpu | 20 | 時間/週 | weekly |
| `elevenlabs` | ElevenLabs | voice | 10000 | credits/月 | monthly |

- 画面の挙動は既存セクションと同一：手入力による使用量記録（localStorage、サービス×アカウントのキー体系は docs/09 参照）と、ライブ実測パネル（readings）がそのまま使える。
- 種別フィルタ（すべて／動画生成／ローカル／GPU／音声生成）と `GET /api/catalog?kind=gpu|voice` にも対応した。

## 2. 無料枠の取得元（クォータソース）

### Kaggle（GPU / TPU）

- 無料枠は GPU 30時間/週、TPU 最大20時間/週（本アプリでは別サービスとして2件に分けて管理する）。
- 使用量の取得元は **Kaggle 公式 MCP の `get_accelerator_quota`** ツール。内部的には Kaggle バックエンドの `GetAcceleratorQuotaStatistics` を叩いており、アクセラレータ種別ごとの使用済み時間・上限・リセット時刻が返る。
- MCP が使えない環境では、同じ統計を返すバックエンド API を直接読むフェッチャでも代替できる（形式は readings に正規化して取り込む）。

### ElevenLabs

- 無料プランは 10,000 クレジット/月。
- 使用量の取得元は **`GET /v1/user/subscription`**（公式 API）。レスポンスに次が含まれる：
  - `character_count` — 今サイクルの使用済み文字数（＝使用済みクレジット相当）
  - `character_limit` — 上限
  - `next_character_count_reset_unix` — 次回リセット時刻（Unix 秒）
- API キーには **`user_read` 権限**が必要（権限のないキーではこのエンドポイントがエラーを返す）。

## 3. 実測（readings）の作り方

Muse と同じパターン（docs/09 §3「Muse の実測の作り方」）で、**外部フェッチャが実測して `data/readings.json` を配置する**運用にする：

1. フェッチャ（Muse 側のエージェント等）が各サービスの取得元から最新値を取得する。**API キーは Muse の Secure Vault に保管し、アプリ側・リポジトリ側には一切置かない**（`.env` にも書かない）。
2. 取得値を readings 形式に正規化する（下記ウィンドウ対応表参照）。`source` は取得元の識別子（例：`kaggle-mcp`、`elevenlabs-api`）、`capturedAt` は取得時刻。
3. アプリが動いているマシンへ SSH 等で `data/readings.json` を配置（既存エントリは serviceId+accountId 単位でマージ/置換）。
4. 画面を再読み込みするとライブパネルに反映される。24時間を超えた実測には自動で「古い可能性」バッジが出る。

### ウィンドウ対応表

| サービス | windowMinutes | usedPercent の算出 | resetsAt |
|---|---|---|---|
| Kaggle GPU (`kaggle`) | 10080（週間） | 使用済みGPU時間 / 30時間 × 100 | 取得元が返す週次リセット時刻 |
| Kaggle TPU (`kaggle-tpu`) | 10080（週間） | 使用済みTPU時間 / 20時間 × 100 | 同上 |
| ElevenLabs (`elevenlabs`) | 43200（月間） | `character_count` / `character_limit` × 100 | `next_character_count_reset_unix`（そのまま Unix 秒） |

- Kaggle は GPU と TPU で枠が独立しているため、**1サービスに2ウィンドウではなく2サービスに分ける**（カード・手入力・枯渇判定が枠ごとに独立する）。
- ElevenLabs の `character_limit` はプランで変わり得る。実測の usedPercent は API が返した実値から算出し、カタログの 10000 は無料プランの目安として手入力時の上限に使う。

## 4. 注意：API プールと Web プールの財布は別

- 多くの生成系サービスでは、**Web アプリ側の無料枠と API 側の枠は別財布**であり、API で取れる残量が Web 利用分の残量と一致するとは限らない。
- 本連携で取り込む実測は「取得元が見ている枠」の値である：
  - Kaggle の `get_accelerator_quota` はアカウント全体のアクセラレータ枠（ノートブック実行が消費する枠そのもの）なので、この心配は小さい。
  - ElevenLabs の subscription API はアカウントの文字数枠そのものを返すが、Web 側の表示と集計タイミングがずれる場合がある。
- 画面のライブパネルには出典（source）と取得時刻が常時表示されるので、値の出どころと鮮度は見た目で判断できる。実測と実感が合わない場合は、手入力がフォールバックとして常に優先できる（docs/09 参照）。

## 5. テスト

- 対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% を維持。
- カタログテストに、種別の網羅（4種別）、セクションラベル、サービス総数 12 件と新規3件の定義値（上限・単位・周期）を追加した。
