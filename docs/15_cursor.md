# Cursor（カタログ登録とブラウザ確認）

対象ブランチ: `feature/cursor-catalog`
実装日: 2026-11-19

## 1. 概要

Cursor をカタログに登録した（サービス総数 18 → 19 件）。Codex / Antigravity と同じ「%スタイル・ローカルツール」の表現で、具体的な上限値を公開していないサービスとして正直に登録する。実測の取得は API ではなく**ブラウザのダッシュボード確認**が唯一の経路（§3）。

| サービスID | 名称 | kind | 上限 | 単位 | 周期 | ダッシュボード |
|---|---|---|---|---|---|---|
| `cursor` | Cursor (ローカル) | local | 100 | %(included usage・上限非公開) | weekly | https://cursor.com/dashboard |

配置は配列順でコーディングツール群（`codex` / `antigravity`）の直後、`muse` の前。

## 2. 検証済みの事実（2026-11-19、ユーザーのログイン済みダッシュボードで実測）

- プラン名は **「Free」**（旧称 Hobby ではない新世代の無料プラン表示）。
- **「Your included usage」は「0% used」** と表示されていた。
- **「Resets 2026年11月21日」** と具体的なリセット日が表示される。
- リクエスト数などの**具体的な数値上限は一切表示されない**。
- On-Demand（従量課金）spending は Premium（有料）プラン向けであり、Free では使えない。

## 3. API リーダーが存在しない理由

調査（`~/workspace/quota-research/coding-tools-quota.md` §2）に基づく：

- Cursor には**公開された使用量 API が存在しない**。`cursor-agent` CLI も認証状態とプラン名しか返さず、使用量は返さない。
- 唯一の実在する取得経路は非公開の DashboardService API（`api2.cursor.sh`）だが、認証には **IDE のローカル state DB（`state.vscdb`）からセッショントークンを取り出す**必要がある。本プロジェクトのリーダーは保存済み認証情報を抜き出す方式を採らない（トークンは利用者が発行したものだけを環境変数で受け取る、docs/11・12 の方針）ため、この経路は採用しない。
- ローカルファイル（`state.vscdb` / `ai-code-tracking.db`）にはクォータ数値自体が含まれない（認証情報と AI 著作テレメトリのみ）。

したがって Cursor の実測は、Codex のダッシュボード経路と同じく**ブラウザ確認 → readings への投入**で運用する。

## 4. 周期（cycle）の選定について

- `ResetCycle` は固定 enum（daily / weekly / monthly / 5hour）のため、最も近いものを選ぶ必要がある。
- プラン表示「Free」は、調査で「週次の included プールを持つ新世代の無料プラン」として報告されている世代と一致する（旧 Hobby 世代は月次リセット）。そのため `weekly` を採用した。
- ただし**実際に効くのはダッシュボードに表示される具体的なリセット日**であり、カタログの周期は目安にすぎない。note にも「リセット日はダッシュボード表示が正（確認時: 2026-11-21）」と明記した。アカウントの周期が月次であることが判明したら、カタログのこの1フィールドだけを直す。

## 5. ブラウザ確認の手順と readings への投入

1. 普段 Cursor を使っているブラウザで https://cursor.com/dashboard を開く（ログイン済みセッション前提。未ログインならサービス側のログインが先に表示される — docs/14 のモデルどおり）。
2. 「Your included usage」の使用率（%）と「Resets」の日付を読む。
3. 以下の形式で `data/readings.json` に投入する（他エントリは保持し、`cursor` のエントリだけ置き換える — docs/09 のマージ方式と同じ）：

| 項目 | 値 |
|---|---|
| `serviceId` | `cursor` |
| `source` | `cursor-dashboard` |
| `capturedAt` | 確認した時刻（ISO 8601、UTC） |
| `windows[0].windowMinutes` | 10080（週間。ダッシュボードの表示周期に合わせる） |
| `windows[0].usedPercent` | ダッシュボード表示の使用率 % |
| `windows[0].resetsAt` | ダッシュボード表示のリセット日（現地時間 00:00）を Unix 秒に変換したもの |
| `note` | 例: `Freeプラン included usage（ダッシュボード確認）` |

- 更新タイミングはイベント駆動（使ったタイミング・対話のついで）であり、定期ポーリングはしない（無料枠の節約方針 — MEMORY 参照）。
- 24時間を超えた実測には自動で「古い可能性」バッジが出る。ダッシュボード未確認の間は、カードへの手入力がフォールバックとして従来どおり使える。

## 6. テスト

- `tests/catalog.test.ts`:
  - サービス総数 19 件。
  - `cursor` の個別表明：名称・kind=local・limit=100・単位 `%(included usage・上限非公開)`・周期 weekly・`dashboardUrl` が `https://cursor.com/dashboard`。
  - note に「非公開」と「ダッシュボード」が含まれること（上限を公開しているかのような誤認を防ぐ）。
  - 配列順が `antigravity` の直後、`muse` より前であること。
- 対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% を維持。
