# バランス型ライブ実測（Balance Readings）

対象ブランチ: `feature/balance-readings`

## 1. 概要

ライブ実測のウィンドウ（`ReadingWindow`）を拡張し、**バランス型**サービスに対応した。

従来のウィンドウは「上限に対する使用率（`usedPercent`）」が前提だった。しかし Civitai の Buzz のように、**上限がなく残高が蓄積していくタイプ**のサービスでは使用率という概念自体が意味を持たない。そこでウィンドウに自由文の実測値 `detail`（例: `Blue Buzz 残高 1,234`）を持てるようにし、`usedPercent` を任意項目にした。

対象サービス（想定）:

- **Civitai**（Blue Buzz: 日次報酬などで増える蓄積型残高、上限なし）
- 将来の候補: **Viyou**（Coins）、**Mage**（Gems）など、残高表示が自然なサービス

## 2. モデル変更

`src/shared/types.ts`:

```ts
export interface ReadingWindow {
  windowMinutes: number;
  usedPercent?: number; // バランス型では省略
  detail?: string;      // 自由文の実測値（例 "Blue Buzz 残高 1,234"）
  resetsAt: number;     // Unix 秒
}
```

- `windowMinutes` と `resetsAt` は従来どおり必須。
- `usedPercent` と `detail` はどちらか一方（または両方）があればよい。

## 3. ウィンドウの妥当性ルール

`src/shared/lib/readings.ts` の `parseReadingWindow` が実施する。パーサーは従来どおり防御的で、不正な入力は例外にせず読み捨てる。

1. `windowMinutes` と `resetsAt` が有限数でなければ無効。
2. `usedPercent` が有限数なら採用する。数値でない・NaN などの場合は**「無いもの」として扱う**（それだけで無効にはしない）。
3. `detail` が空でない文字列なら採用する。文字列でない場合は**「無いもの」として扱う**。
4. 2 と 3 のどちらも残らなかったウィンドウは無効として捨てる。その結果ウィンドウが0件になった実測は、従来どおり実測自体を棄却する。

## 4. 画面表示

`src/shared/ui/service-card.tsx` のライブパネルでは、存在する項目だけを表示する（`%` が先、`detail` が後）。

- パーセントのみ: `週間: 8.1% / リセット 2026/11/21 9:00:00`
- detail のみ: `1440分: Blue Buzz 残高 1,234 / リセット 2026/11/20 9:00:00`
- 両方: `週間: 8.1% Blue Buzz 残高 1,234 / リセット ...`

（1440分は現行の `windowLabels` に専用ラベルが無いため分表記のフォールバックになる。）

## 5. readings.json の例（Civitai）

日次ウィンドウ（1440分）、リセットは翌日 00:00 UTC、`detail` に残高、複数色の Buzz 残高は `note` に併記する。

```json
{
  "readings": [
    {
      "serviceId": "civitai",
      "source": "civitai-reader",
      "capturedAt": "2026-11-19T12:00:00.000Z",
      "windows": [
        {
          "windowMinutes": 1440,
          "resetsAt": 1795132800,
          "detail": "Blue Buzz 残高 1,234"
        }
      ],
      "note": "Blue Buzz 1,234 / Yellow Buzz 0"
    }
  ]
}
```

（`resetsAt` 1795132800 は 2026-11-20T00:00:00Z。）
