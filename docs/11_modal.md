# Modal の追加（GPUセクション）

対象ブランチ: `feature/modal-support`

## 1. 概要

GPU サービスに Modal を追加した（定義は従来どおり `src/shared/config/catalog.ts` のみが正）。サービス総数は 13 件になった。

| サービスID | 名称 | kind | 上限 | 単位 | 周期 |
|---|---|---|---|---|---|
| `modal` | Modal | gpu | 30 | USD/月 | monthly |

Modal の Starter プランには **$30/月 の無料クレジット** が付く。本アプリでは「今月の使用額（USD）÷ $30」を使用量として管理し、上限到達＝無料クレジット消尽として扱う。

## 2. なぜ実測の自動取得が限定的なのか

- Modal には Workspace の課金レポート API（Python SDK の `Workspace.billing.summary()` / `billing.report()`、`modal billing` CLI）があるが、**公式の billing ガイドではプログラム経由のレポート API は Team / Enterprise プラン向け**とされている。
- そのため **Starter では API が権限エラーになる可能性が高く、ダッシュボード（Usage & Billing）での確認が基本**になる。リーダースクリプトは「取れたら取り込む」位置づけで、失敗しても手入力にフォールバックできる設計にしてある。

## 3. リーダースクリプトの使い方

`scripts/readers/modal_billing.py`（Python 3、公式 `modal` SDK 使用）：

```bash
pip install modal
export MODAL_TOKEN_ID=...        # Modal ダッシュボード -> Settings -> API Tokens
export MODAL_TOKEN_SECRET=...
python3 scripts/readers/modal_billing.py
```

- **アカウント所有者本人の環境で実行する**こと（トークンはその人のワークスペースのものを使う）。
- 認証情報は **環境変数からのみ** 読む。引数では受け取らず、値そのものを出力することもない。`.env.sample` にプレースホルダがあるが、実トークンを `.env` やリポジトリに書いてはいけない。
- 取得するのは現サイクルの総使用額（`metered_cost`、調整前の実支出）。SDK 呼び出しはスクリプト内の `fetch_monthly_spend_usd()` 1関数に隔離してある。
- 失敗時の挙動（いずれも終了コード 0、`data/readings.json` には触らない）：
  - 環境変数が未設定 → 設定すべき変数名を案内して終了
  - SDK 未インストール → `pip install modal` の案内を表示して終了
  - API 呼び出し失敗（Starter の権限エラー等） → エラー概要を表示して終了

## 4. 実測の対応づけ

| 項目 | 値 |
|---|---|
| `serviceId` | `modal` |
| `source` | `modal-billing-api` |
| `windowMinutes` | 43200（月間） |
| `usedPercent` | 今月の使用額 / $30 × 100（小数1桁） |
| `resetsAt` | 翌月1日 00:00 UTC の Unix 秒 |
| `note` | `今月 $X.XX / $30 使用` |

マージ方式は Codex リーダー（docs/09）と同一：既存エントリを保持し、`modal` のエントリだけ置き換える。24時間を超えた実測には自動で「古い可能性」バッジが出る。

## 5. フォールバック

- API が使えない場合は、**ダッシュボード（Usage & Billing）で今月の使用額を確認し、カードに手入力**する（単位は USD/月、そのまま金額を入力すれば使用率に換算される）。
- 手入力はいつでも実測より優先して記録できる（docs/09 参照）。

## 6. テスト

- 対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% を維持。
- カタログテストのサービス総数を 13 件に更新し、Modal の定義値（上限・単位・周期）を追加した。
