# テスト・カバレッジレポート

実施日: 2026-11-19 / ツール: Vitest 2.0.5 + @vitest/coverage-v8

## 1. カバレッジ対象範囲（正確な定義）
`vitest.config.ts` の `coverage.include` で明示した以下の範囲のみを100%必須の対象とする。
- `src/shared/lib/**/*.ts`（quota.ts, cn.ts）
- `src/shared/config/**/*.ts`（catalog.ts）

対象外: 画面・コンポーネント（`src/**/*.tsx`）、feature のUI、APIルート（`src/app/**`）、型定義のみのファイル。これらは総合テスト（`docs/06_system-test.md`）で検証する。

## 2. 達成結果
| 指標 | 達成値 | 内訳 |
|---|---|---|
| Statements | 100% | 193 / 193 |
| Branches | 100% | 80 / 80 |
| Functions | 100% | 19 / 19 |
| Lines | 100% | 193 / 193 |

ファイル別: catalog.ts 100%、cn.ts 100%、quota.ts 100%（いずれも statements/branches/functions/lines）。

## 3. テスト実行結果
- テストファイル: 3件（tests/quota.test.ts, tests/catalog.test.ts, tests/cn.test.ts）
- テスト件数: 75件、全件通過（失敗0件）
- 観点表: `docs/05_unit-test-viewpoints.md`（UT-01〜UT-28）。境界値（閾値±1、上限0、超過、全リセット周期・月末・週次月曜・5時間境界）を網羅。

## 4. その他の品質ゲート（同時実施）
| ゲート | コマンド | 結果 |
|---|---|---|
| Lint | `npm run lint` | 合格（exit 0） |
| 型検査 | `npm run typecheck` | 合格（exit 0） |
| 本番ビルド | `npm run build` | 合格 |
| 総合テスト | `docs/06_system-test.md` 参照 | 全項目合格 |

CI（`.github/workflows/ci.yml`）は push / pull_request で npm ci → lint → typecheck → test:coverage → build を実行する。
