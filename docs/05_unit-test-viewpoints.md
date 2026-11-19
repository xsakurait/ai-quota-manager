# 単体テスト観点表

対象範囲: `src/shared/lib/**/*.ts` + `src/shared/config/**/*.ts`（カバレッジ100%必須）。テストファイルは `tests/` 配下。

| ID | 対象 | 観点 | 期待結果 |
|---|---|---|---|
| UT-01 | normalizeUsed | 正常な数値（0・正数・小数） | そのまま返す |
| UT-02 | normalizeUsed | 負値 | 0に正規化 |
| UT-03 | normalizeUsed | 非数値・NaN・±Infinity | 0に正規化 |
| UT-04 | clampUsage | 範囲内（下限ちょうど・上限ちょうど含む） | そのまま返す |
| UT-05 | clampUsage | 上限超過 | 上限に丸める |
| UT-06 | clampUsage | 上限0・負の上限 | 常に0 |
| UT-07 | applyDelta | 増減・両端クランプ | 範囲内に収まる |
| UT-08 | applyDelta | 不正な増減量・不正な現在値 | 増減量0扱い／現在値を正規化 |
| UT-09 | remaining | 通常・上限ちょうど・超過・負の使用量 | 0未満にならない残量 |
| UT-10 | usagePercent | 四捨五入（1/3・2/3）・100超過・上限0/負 | 0〜100の整数、0上限時は0 |
| UT-11 | remainingPercent | 使用率の補数 | 100 − 使用率 |
| UT-12 | statusOf | 閾値−1 / 閾値ちょうど（注意・枯渇の両方） | 通常→注意→枯渇の境界が正しい |
| UT-13 | statusLabel/kindLabel/cycleLabel | 既知キー・未知キー | 設定ラベル／未知はキー自体 |
| UT-14 | findService | 存在するID・存在しないID・空文字 | 定義／undefined |
| UT-15 | parseUsageInput | 数値・前後空白・空・非数値・Infinity混在・負値 | 数値／0に正規化 |
| UT-16 | nextReset daily | 通常日・月末・0時ちょうど | 翌日0時 |
| UT-17 | nextReset weekly | 月曜（7日後）・水曜・土曜・日曜 | 次の月曜0時 |
| UT-18 | nextReset monthly | 月末・12月（年跨ぎ）・1日 | 翌月1日0時 |
| UT-19 | nextReset 5hour | 枠途中・境界ちょうど・20時台・深夜 | 次の5時間境界 |
| UT-20 | nextReset 共通 | 入力Dateを変更しない・引数省略 | 非破壊／現在時刻基準 |
| UT-21 | summarize | 空・全枯渇・カスタムカタログ・不正値・空カタログ | 件数/合計/枯渇件数が正しい |
| UT-22 | filterServices | 種別・検索（大小無視・空白）・複合・0件 | 絞り込み結果が正しい |
| UT-23 | buildStatus | 明示時刻・不正使用量・引数省略 | 全フィールドが整合する |
| UT-24 | loadUsage | null storage・未保存・例外・不正JSON・非オブジェクトJSON・値の正規化・キー指定 | {} または正規化済マップ |
| UT-25 | saveUsage | null storage・正常保存（デフォルト/カスタムキー）・例外 | true/false と書き込み内容 |
| UT-26 | catalog | ID一意性・種別/周期の網羅・ラベル完備・閾値順序 | 定義が整合する |
| UT-27 | catalog env | 環境変数あり・一部のみ・なし | 環境変数優先／フォールバック |
| UT-28 | cn | 結合・falsy除去・競合マージ・配列/オブジェクト・空 | clsx+tailwind-merge の結果 |
