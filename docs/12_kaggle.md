# Kaggle クォータリーダー（GPU / TPU）

対象ブランチ: `feature/kaggle-reader`（初版）、`feature/kaggle-reader-fix`（2026-11-19、実地検証に基づくエンドポイント／パーサ修正）

## 1. 概要

Kaggle の週間アクセラレータ枠（GPU 30時間/週、TPU 最大20時間/週）を公式エンドポイントから取得し、実測（LiveReading）として取り込むリーダーを追加した。カタログ側の定義は既存のまま（`src/shared/config/catalog.ts` の `kaggle` / `kaggle-tpu`、サービス総数 13 件に変更なし）。

| サービスID | 名称 | kind | 上限 | 単位 | 周期 |
|---|---|---|---|---|---|
| `kaggle` | Kaggle GPU | gpu | 30 | 時間/週 | weekly |
| `kaggle-tpu` | Kaggle TPU | gpu | 20 | 時間/週 | weekly |

GPU と TPU は**別サービスとして分けて管理する**。本アプリは「1サービス＝1クォータ」が前提のため、週ウィンドウ（10080分）は共通でも、消費ペースも上限も異なる2つの枠を1エントリに混ぜない。

## 2. 取得方法（公式MCPとその裏側のエンドポイント）

- Kaggle には公式 MCP サーバー（https://www.kaggle.com/mcp）があり、使用量取得ツール `get_accelerator_quota` を提供している。
- その裏側で使われているのが、Connect-RPC 形式のエンドポイントである。正しいホストは `api.kaggle.com` で、パスに `/v1` が付く：

```
POST https://api.kaggle.com/v1/kernels.KernelsApiService/GetAcceleratorQuotaStatistics
Authorization: Bearer <KGAT APIトークン>
Content-Type: application/json
Body: {}
```

- **ホストの注意**: `www.kaggle.com`（`/v1` なし）に投げると HTTP 400 が返る。初版リーダーはこちらを使っていたため取得できず、2026-11-19 の実地検証で判明・修正した。
- リーダーは MCP を経由せず、このエンドポイントを直接叩く（Python 標準ライブラリのみ、依存なし）。
- **公式 kagglesdk を使わない理由**: 公式 kagglesdk はこのレスポンスのパース自体で落ちる（TimeDelta パーサが小数秒を前提としており、整数秒の文字列を処理できない）。そのためリーダーは生 JSON を自前でパースする。

### 実証済みレスポンス形式（2026-11-19 実地検証）

```json
{
  "quotaRefreshTime": "2026-11-21T00:00:00Z",
  "gpuQuota": {
    "timeUsed": "8737.256s",
    "timeReserved": "0s",
    "totalTimeAllowed": "108000s",
    "minimumTimeAllowed": "108000s",
    "hasEverRun": true
  },
  "tpuQuota": {
    "timeUsed": "0s",
    "timeReserved": "0s",
    "totalTimeAllowed": "72000s",
    "minimumTimeAllowed": "72000s"
  }
}
```

- 時間はいずれも protobuf 形式の「秒」文字列（GPU 上限 108000s = 30h、TPU 上限 72000s = 20h）。
- `quotaRefreshTime` が**実際の週間リセット時刻**そのものである。
- リーダーのパーサはまずこの実証形式を主パーサとして解釈する（`extract_verified_stats`）。数値秒など表記ゆれにも耐性を持たせてある。
- **注意**: このエンドポイントは公開契約として安定が保証された API ではないため、将来レスポンス形式が変わりうる。その場合に備え、JSON 内から GPU / TPU それぞれの「使用量＋上限」のペアを寛容に探索する汎用パーサ（`extract_accelerator_stats`）をフォールバックとして残してある。どちらのパーサでも認識できない形式が返った場合は、HTTP ステータスとレスポンス本文（先頭500文字）を表示して診断できるようにし、ファイルには何も書かない。

### 初回実地検証の記録（2026-11-19）

ユーザーの PC 上で実トークン（公式 kagglesdk 経由の疎通確認を含む）を用いて検証した結果：

| 項目 | 値 |
|---|---|
| GPU 使用量 | 8737.256s / 108000s（2.4h / 30h、8.1%） |
| TPU 使用量 | 0s / 72000s（0.0h / 20h、0.0%） |
| quotaRefreshTime | 2026-11-21T00:00:00Z |

## 3. トークン

- 使用するのは **KGAT 形式の API トークン**。作成場所: https://www.kaggle.com/settings/api（「API Tokens (Recommended)」の Generate New Token）。
- トークンは**環境変数 `KAGGLE_API_TOKEN` からのみ**読む。引数では受け取らず、値そのものを出力することもない。`.env.sample` にプレースホルダがあるが、実トークンを `.env` やリポジトリに書いてはいけない。
- このトークンは将来の生成パイプラインでもそのまま使える（§6）。

## 4. リーダースクリプトの使い方

`scripts/readers/kaggle_quota.py`（Python 3、標準ライブラリのみ）：

```bash
export KAGGLE_API_TOKEN=...     # https://www.kaggle.com/settings/api で作成
python3 scripts/readers/kaggle_quota.py
```

- **アカウント所有者本人の環境で実行する**こと（トークンはその人のアカウントのものを使う）。
- GPU / TPU のうち、レスポンスから使用量＋上限のペアが取れた方だけを書き込む（片方だけでも可）。

## 5. 実測の対応づけ

| 項目 | 値 |
|---|---|
| `serviceId` | GPU → `kaggle`、TPU → `kaggle-tpu` |
| `source` | `kaggle-api` |
| `windowMinutes` | 10080（週間） |
| `usedPercent` | レスポンスの使用量 / 上限 × 100（小数1桁）。実証形式では秒どうしで計算する |
| `resetsAt` | **レスポンスの `quotaRefreshTime` を Unix 秒に変換したもの（実際のリセット時刻）** |
| `note` | `GPU 2.4h / 30h 使用` の形式（数値はレスポンスの実値。カタログの上限値で固定しない） |

- **resetsAt は実時刻になった**：実証形式のレスポンスには `quotaRefreshTime`（実際の週間リセット時刻）が含まれるため、そちらをそのまま使う。`quotaRefreshTime` が無いレスポンス（形式変更時など）に限り、従来の「翌週月曜 00:00 UTC」という近似にフォールバックする。その場合のみ目安として扱い、正確な締切とはみなさないこと。
- マージ方式は Codex / Modal リーダー（docs/09、docs/11）と同一：既存エントリを保持し、`kaggle` / `kaggle-tpu` のエントリだけ置き換える。24時間を超えた実測には自動で「古い可能性」バッジが出る。

## 6. 将来の生成パイプラインとの関係

今回のトークンは、クォータ取得だけでなく、Kaggle を無料GPUの実行基盤として使う生成パイプライン（Kaggle + ComfyUI + Wan 2.2）の駆動にもそのまま使える。Kaggle API はノートブックの push（バッチ実行）→ ステータス監視 → output 回収まで CLI / API で完結するため、「生成を実行したタイミングでクォータ実測も更新する」というイベント駆動の更新と相性がよい。パイプライン自体の設計は別途行う。

## 7. 失敗時の挙動

いずれも終了コード 0 で、`data/readings.json` には触らない。

- 環境変数 `KAGGLE_API_TOKEN` が未設定 → トークンの作成場所を案内して終了
- ネットワークエラー / HTTP エラー（無効なトークンで 401/403 等） → エラー概要（HTTP の場合はステータスと本文の先頭500文字）を表示して終了
- HTTP 200 だが形式を認識できない → ステータスと本文の先頭500文字を表示して終了（形式変更の診断用）
- 上限が 0 のペアしか取れない → 何も書かずに終了

フォールバックは従来どおり、Kaggle の設定画面 / ノートブックの Settings ペインで使用量を確認し、カードに手入力する（docs/09 参照）。

## 8. テスト

- アプリ側の変更はないため、対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% をそのまま維持。
- リーダーは手元で以下を確認済み：
  - 環境変数なし → 案内メッセージを表示して終了コード 0、`data/readings.json` は作成されない
  - 無効なトークン（`KGAT_invalid`） → エラー概要を表示して終了コード 0、ファイルには書かない
  - 実トークンでの実地検証（2026-11-19、ユーザーの PC）→ `api.kaggle.com/v1` エンドポイントから HTTP 200 で実証形式のレスポンスを取得（記録は §2）
