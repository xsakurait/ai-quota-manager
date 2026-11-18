# 詳細設計書 01 残量・使用率・状態判定ロジック

共通項目は `00_index-and-common.md`（D-C1〜D-C4）および基本設計 `00_common.md`（C-2, C-3）を参照する。閾値・上限の値は複写しない。

## 対象モジュール
`src/shared/lib/quota.ts`

## 関数詳細
### normalizeUsed(value: unknown): number
- 入力: 任意の値。
- 処理: 数値でない・有限でない場合は 0 を返す。負値は 0 に正規化する。それ以外はそのまま返す。
- 出力: 0以上の有限数。

### clampUsage(def, value): number
- 入力: サービス定義、使用量候補。
- 処理: normalizeUsed で正規化した後、上限が0以下の場合は 0 を返す。上限を超える場合は上限に丸める。
- 出力: 0〜上限の範囲の使用量。

### applyDelta(def, current, delta): number
- 処理: 現在値に増減量（有限でない場合は0として扱う）を加え、clampUsage で範囲内に収める。

### remaining(def, used): number
- 処理: 上限 − 正規化した使用量。0未満にはならない。

### usagePercent(def, used): number
- 処理: 上限が0以下の場合は 0。使用量÷上限×100 を四捨五入し、100を超える場合は100に丸める（D-C2）。

### remainingPercent(def, used): number
- 処理: 100 − usagePercent。

### statusOf(def, used): Status
- 処理: C-3 の判定順序に従い、使用率と共通閾値を比較して `ok` / `warning` / `exhausted` を返す。

### statusLabel(status): string / kindLabel(kind) / cycleLabel(cycle)
- 処理: 共通設定のラベル表から引く。未知のキーの場合はキー文字列自体を返す。

### findService(id): ServiceDef | undefined
- 処理: 共通設定のカタログからIDで検索する。

### parseUsageInput(raw: string): number
- 処理: 空文字は0。数値化できない入力は0。負値は0に正規化する。
