# 詳細設計書 02 使用量記録

共通項目は `00_index-and-common.md` および基本設計 C-5 を参照する。

## 対象モジュール
- `src/features/usage-record/`（入力UI: UsageControls）
- `src/features/dashboard/`（状態保持と保存）

## 処理詳細
### 状態保持
- ダッシュボードは `Record<string, number>` 形式でサービスID→使用量を保持する。
- 初期表示時、localStorage（キーは共通設定）から読み込み、JSONとして解釈する。不正なJSON・オブジェクトでない値・配列は空として扱う。各値は読み込み時に正規化する。

### 保存
- 使用量が変化するたびに、共通設定の保存キーで localStorage にJSON保存する。
- 保存失敗（容量超過等）は例外を握りつぶし、画面動作を継続する。

### +/- 操作
- + ボタン: applyDelta(+1)、- ボタン: applyDelta(-1) を適用する（01参照）。

### 直接入力
- 数値入力欄の変更で parseUsageInput → clampUsage を適用し即時保存する。

### ロード関数 loadUsage(storage): Record<string, number>
- 純粋に近い読み取り処理として shared/lib に置き、単体テスト対象とする。
- storage が null の場合は空オブジェクトを返す。
