# Civitai Buzz 残高リーダー

対象ブランチ: `feature/civitai-reader`（初版）

## 1. 概要

Civitai の無料通貨 **Blue Buzz**（および Yellow / Green Buzz）の残高を、公式の tRPC エンドポイントから取得し、実測（LiveReading）として取り込むリーダーを追加した。カタログ側の定義は既存のまま（`src/shared/config/catalog.ts` の `civitai`、kind: image、daily）。

| サービスID | 名称 | kind | 管理方式（従来） |
|---|---|---|---|
| `civitai` | Civitai | image | Blue Buzz は日次報酬（00:00 UTC リセット）＋コミュニティ行動で獲得。固定額は公式非公開・残高は蓄積型のため % 手入力で管理していた |

**Buzz は「上限のある消費枠」ではなく蓄積型の残高**であるため、実測は `usedPercent` を持たない**残高ウィンドウ**（balance window）として記録する：ウィンドウの `detail` に残高そのものを入れ、`resetsAt` は日次報酬のチェックポイントである翌日 00:00 UTC とする。アプリ側の残高ウィンドウ対応（パース・表示）は `feature/balance-readings` で別途行う（docs/16 参照）。本リーダーはその JSON 形式で書き出すところまでを担当する。

## 2. 取得方法（tRPC と2つのプロシージャ名）

- Civitai の**公式開発者ドキュメント**では、Buzz 残高の読み取りは tRPC プロシージャ **`buzz.getUserAccount`**（OAuth の BuzzRead スコープ）とされている。なお `GET /api/v1/me` は残高を返さない。
- 一方、**Civitai 公式 CLI の設計ドキュメント**（github.com/civitai/cli）では、**パーソナル API キーでも tRPC を呼べる**ことが実地検証されており、**`buzz.getBuzzAccount` が HTTP 200 で実際の残高を返した**（不正なトークンは 401）。Web アプリ自体も `trpc.buzz.getBuzzAccount` を呼び、`buzzAccounts` の色別残高（blue / yellow / green）を読んでいる。
- そのため本リーダーは **`buzz.getBuzzAccount` を主**とし、HTTP エラーが返った場合に限り、ドキュメント記載の **`buzz.getUserAccount` へ1回だけフォールバック**する。

```
GET https://civitai.com/api/trpc/buzz.getBuzzAccount
Authorization: Bearer <パーソナルAPIキー>
```

- tRPC の GET レスポンスは `{"result": {"data": {"json": ... }}}` というエンベロープ形式で返る。リーダーはこれを防御的に剥がし（素のオブジェクトも受理する）、内側の JSON から **blue / yellow / green のキー**を再帰的に探索する。各色の値は数値そのもの、または `balance` / `amount` / `total` / `value` のいずれかを含むオブジェクトを想定する（アカウントペイロードの正確な形式は公式に fully documented ではないため）。
- リーダーは Python 標準ライブラリのみで実装し、依存はない。

## 3. トークン（パーソナル API キー）

- Civitai にログインし、**アカウント設定（Settings）の「API Keys」**からパーソナル API キーを作成する。
- トークンは**環境変数 `CIVITAI_API_TOKEN` からのみ**読む。引数では受け取らず、値そのもの（一部も含む）を出力することもない。`.env.sample` にプレースホルダがあるが、実トークンを `.env` やリポジトリに書いてはいけない。

## 4. リーダースクリプトの使い方

`scripts/readers/civitai_buzz.py`（Python 3、標準ライブラリのみ）：

```bash
export CIVITAI_API_TOKEN=...   # Civitai のアカウント設定 → API Keys で作成
python3 scripts/readers/civitai_buzz.py
```

- **アカウント所有者本人の環境で実行する**こと（トークンはその人のアカウントのものを使う）。

## 5. 実測の対応づけ

| 項目 | 値 |
|---|---|
| `serviceId` | `civitai` |
| `source` | `civitai-api` |
| `windowMinutes` | 1440（日次） |
| `resetsAt` | **翌日 00:00 UTC** の Unix 秒（日次報酬のリセット＝チェックポイント） |
| `detail` | `Blue Buzz 残高 <blue>` の形式。Blue が無い場合は、最初に見つかった色で `<Color> Buzz 残高 <値>` とする |
| `note` | `Blue <b> / Yellow <y> / Green <g>` の形式。**見つかった色のみ**を含める |
| `usedPercent` | **付けない**（残高型のため） |

出力例：

```json
{
  "serviceId": "civitai",
  "source": "civitai-api",
  "capturedAt": "2026-11-19T03:01:18Z",
  "windows": [
    { "windowMinutes": 1440, "resetsAt": 1795132800, "detail": "Blue Buzz 残高 1500" }
  ],
  "note": "Blue 1500 / Yellow 250 / Green 30"
}
```

- 数値はカンマ区切りなしの整数表記。
- マージ方式は Kaggle / Modal リーダー（docs/12、docs/11）と同一：既存エントリを保持し、`civitai` のエントリだけ置き換える。既存ファイルの読み取りは `utf-8-sig`（BOM 耐性あり）。24時間を超えた実測には自動で「古い可能性」バッジが出る。

## 6. 状態（未実地検証）

**本リーダーはまだ実トークンでの実地検証をしていない。** エンドポイントと認証方式は公式開発者ドキュメントと公式 CLI の実地検証に基づくが、ペイロードの正確な形式は公式に明記されていないため、**初回の実地実行でエンベロープや形式の調整が必要になる可能性がある**。失敗時は HTTP ステータスとレスポンス本文（先頭500文字）を表示するので、それを基にパーサを調整すること。

手元での確認（オフライン）は済んでいる：

- 環境変数なし → 案内メッセージを表示して終了コード 0、`data/readings.json` は作成されない
- fetch をスタブした合成エンベロープ形式のレスポンス → blue / yellow / green の抽出、残高ウィンドウの JSON 形式、BOM 付き既存ファイルでの他サービスエントリ保持、Blue 欠落時の detail フォールバック（Yellow）、主プロシージャ HTTP エラー時のフォールバック動作を検証済み

## 7. 失敗時の挙動

いずれも終了コード 0 で、`data/readings.json` には触らない。

- 環境変数 `CIVITAI_API_TOKEN` が未設定 → キーの作成場所を案内して終了
- ネットワークエラー → エラー概要を表示して終了
- 両プロシージャとも HTTP エラー（無効なトークンで 401 等） → 最後のステータスと本文の先頭500文字を表示して終了
- HTTP 200 だが色別残高を認識できない → ステータスと本文の先頭500文字を表示して終了（形式変更・初回調整の診断用）

フォールバックは従来どおり、Civitai のサイトで残高を確認し、カードに手入力する。

## 8. テスト

- アプリ側の変更はないため、対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% をそのまま維持。
- リーダーのオフライン確認内容は §6 のとおり。
