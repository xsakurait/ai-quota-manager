# ライブ実測（Live Readings）と複数アカウント対応

対象ブランチ: `feature/live-readings-multiaccount`

## 1. 概要

2つの拡張を入れた。

1. **複数アカウントモデル**: 1サービスをアカウント単位で管理できる汎用モデル。Muse はこの方式で複数アカウントの使用量を分けて管理する。
2. **ライブ実測の取り込み**: 外部（リーダースクリプトや別エージェント）が実測した使用率を `readings.json` としてアプリに渡し、画面のカードに「ライブ」パネルとして表示する。実測が無い・古い場合は、従来どおり手入力が正になる（フォールバック）。

共通値は従来どおり `src/shared/config/catalog.ts` のみが正（読み取りファイルのパス、古さの閾値、ウィンドウラベル、ライブパネルのラベル）。

## 2. 複数アカウントモデル

### 型とカタログ

- `AccountDef { id, label }` を追加し、`ServiceDef.accounts?: AccountDef[]` でサービスにアカウント一覧を持てるようにした。
- 現在は `muse` のみ `accounts: [{ id: "primary", label: "メイン" }]` を持つ。他サービスは変更なし。

### 使用量の保存キー

- アカウント無しサービス: 従来どおりキー = サービスID（例 `runway`）。
- アカウント有りサービス: キー = `${serviceId}:${accountId}`（例 `muse:primary`）。
- 保存先は従来と同じ localStorage の単一マップ（キーだけが変わる）。純粋関数は `src/shared/lib/accounts.ts`：
  - `usageKey(serviceId, accountId?)` — キー生成。accountId が無い/空ならサービスIDのみ。
  - `resolveAccounts(service)` — accounts があればそれを、無ければ暗黙のデフォルトアカウント1件を返す。
  - `getUsage(map, serviceId, accountId?)` — マップから正規化済みの使用量を取る。
- 集計 `summarize` もアカウント単位で数える（対象件数・上限・枯渇はアカウント行ごとの合計）。

### 画面

- 各セクションは `resolveAccounts` でサービス×アカウントのカードを描く。アカウント有りはカードにアカウントラベルのバッジが出て、使用量コントロールもアカウントごとに独立する。
- アカウント無しのサービスは従来と完全に同じ表示・操作。

### アカウントの追加方法（Muse）

`src/shared/config/catalog.ts` の `muse` エントリの `accounts` 配列に1件足すだけ。画面・API・集計は自動で追随する。

```ts
accounts: [
  { id: "primary", label: "メイン" },
  { id: "sub", label: "サブ" }, // ← 追加はこの1行
]
```

- `id` は英小文字など一意な文字列（保存キーの一部になる）。既存アカウントの `id` は変えないこと（変えると過去の使用量と紐づかなくなる）。
- 上限・単位・周期はサービス共通（アカウントごとに変える設計にはしていない）。

## 3. ライブ実測（readings）

### データ形式

サーバーが読むファイル（デフォルト `./data/readings.json`、環境変数 `READINGS_FILE` で変更可。`.env.sample` 参照）：

```json
{
  "readings": [
    {
      "serviceId": "codex",
      "accountId": "primary",
      "source": "codex-rollout",
      "capturedAt": "2026-11-19T02:00:00.000Z",
      "windows": [
        { "windowMinutes": 300, "usedPercent": 42, "resetsAt": 1795060800 },
        { "windowMinutes": 10080, "usedPercent": 10, "resetsAt": 1795489200 }
      ],
      "note": "任意のメモ"
    }
  ]
}
```

- `accountId` と `note` は任意。`resetsAt` は Unix 秒。
- 形式の見本はコミット済みの `data/readings.sample.json`。実ファイル `data/readings.json` は Git 管理外（`.gitignore`）。
- パースは `src/shared/lib/readings.ts` の `parseReadings` が担い、不正なエントリは黙って捨てる（例外にしない）。ルートは `{readings: [...]}` でも配列そのものでもよい。

### API

- `GET /api/readings` — サーバー側でファイルを読み、`{ readings: LiveReading[] }` を返す。ファイルが無い・読めない場合は空配列で 200（500 にしない）。
- 画面は起動時にこの API を fetch し、サービス（＋アカウント）に一致する実測があればカードにライブパネルを出す。

### ライブパネル表示

- ウィンドウごとに「ラベル: 使用率% / リセット日時（ja-JP）」。ラベルは `CONFIG.windowLabels`（300分=5時間、10080分=週間、43200分=月間、それ以外は「N分」）。
- 出典（source）と取得時刻（capturedAt）を併記する。
- **古い可能性バッジ**: 次のどちらかで表示する（`isStale`、閾値は `CONFIG.readingStaleHours` = 24時間）。
  1. capturedAt が閾値より古い。
  2. 全ウィンドウの resetsAt が既に過去（＝その実測が指す枠は終わっている）。

### Muse の実測の作り方

Muse 自体はクラウド管理でローカルファイルが無いので、**外部エージェントが実測値を `readings.json` に書き込む**運用にする：

1. 別エージェント（例：この Muse）が Muse の使用量を確認する（サブスクリプション状態の確認など）。
2. `{ serviceId: "muse", accountId: "primary", source: "muse-agent", capturedAt: <確認時刻>, windows: [...] }` を作る。アカウントが複数あればアカウントごとに1エントリ。
3. アプリが動いているマシンへ SSH 等で `data/readings.json` を配置（既存エントリは serviceId+accountId 単位でマージ/置換）。
4. 画面を再読み込みするとライブパネルに反映される。古くなれば自動で「古い可能性」が出るので、鮮度は見た目で分かる。

### Codex リーダー

`scripts/readers/codex.mjs`（依存なしの素の Node）：

```bash
node scripts/readers/codex.mjs
```

- **Codex を使っている本人のユーザーで実行する**（ロールアウトファイルはそのユーザーのホームにあるため）。
- `$CODEX_HOME`（未設定なら `~/.codex`）の `sessions` 以下から `rollout-*.jsonl` を新しい順に探し、最後の `rate_limits` スナップショットを抽出する。抽出ロジックは `src/shared/lib/codex-rollout.ts` の `extractLatestRateLimits` と同一（スクリプト単体で動かすため意図的に複写し、相互参照コメントを付けた）。
- 結果を `./data/readings.json` にマージする（他サービスのエントリは保持、同 serviceId+accountId は置換）。
- Codex のデータが無い場合はメッセージを出して終了コード 0 で終わり、ファイルには触らない。
- 実測の鮮度は「最後に Codex を使った時刻」まで。しばらく使っていない実測は「古い可能性」表示になる。

## 4. テスト

- 対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% を維持。新規 lib（accounts / readings / codex-rollout）は境界値を網羅した単体テストを追加した。
- リーダー `.mjs` はテスト対象外だが、フィクスチャのロールアウトファイルで実行し、`data/readings.json` への書き込みと「データ無し時は無変更」を確認済み。
