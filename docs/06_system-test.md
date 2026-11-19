# 総合テスト仕様書 兼 実施結果

実施日: 2026-11-19 / 実施環境: Node.js v24.22.1, npm 10.9.4, Next.js 14.2.5（ローカル環境）

## 1. 機能テスト
| ID | 対象 | 手順・確認内容 | 期待結果 | 実施結果 |
|---|---|---|---|---|
| ST-01 | ダッシュボード表示 (F1) | `npm run build` 後 `npm run start` で `/` にアクセス | HTTP 200、アプリ名が表示される | 合格（200、タイトル表示を確認） |
| ST-02 | API catalog (F1/F6) | `GET /api/catalog` | 全9サービスの定義と共通設定メタを返す | 合格（9件、値は共通設定由来） |
| ST-03 | API catalog 絞り込み (F5) | `GET /api/catalog?kind=local` | ローカル3件（codex/antigravity/muse）のみ返す | 合格（3件） |
| ST-04 | API catalog 1件 (F1) | `GET /api/catalog/kling` | Kling AI の定義を返す | 合格 |
| ST-05 | API catalog 404 | `GET /api/catalog/nope` | 404 + SERVICE_NOT_FOUND | 合格（404） |
| ST-06 | API usage検証 (F2/F3) | `POST /api/usage/validate` に上限超過値（kling に 999）を送信 | 上限にクランプされ used=66、使用率100、状態=枯渇 | 合格（used=66, usagePercent=100, status=exhausted） |
| ST-07 | API usage検証 400 | 不正JSONを送信 | 400 + INVALID_BODY | 合格（400） |
| ST-08 | API usage検証 404 | 存在しない serviceId を送信 | 404 + SERVICE_NOT_FOUND | 合格（404） |
| ST-09 | API status集計 (F3/F4) | `GET /api/status?used_kling=66` | summary（count=9, used=66, limit=1701, exhausted=1）と各サービスの状態・次回リセットを返す | 合格（期待値と一致） |
| ST-10 | 使用量記録 (F2) | 画面の +/-・直接入力と localStorage 保存は Dashboard の loadUsage/saveUsage 経由。保存・読込ロジックは単体テスト UT-24/UT-25 で検証 | 保存した使用量が再読込後に復元される | 合格（単体テストで検証。ブラウザ上の目視確認は利用者環境で実施可能） |
| ST-11 | 検索・絞り込み (F5) | filterServices の単体テスト UT-22 および API の kind/q 絞り込み（ST-03） | 種別・名前で正しく絞り込まれる | 合格 |

## 2. 非機能テスト
| ID | 対象 | 確認内容 | 期待結果 | 実施結果 |
|---|---|---|---|---|
| NT-01 | N3 lint | `npm run lint` | エラーなし（`|| true` なし） | 合格（exit 0） |
| NT-02 | N3 型検査 | `npm run typecheck` | エラーなし | 合格（exit 0） |
| NT-03 | N4 カバレッジ | `npm run test:coverage` | 対象範囲で statements/branches/functions/lines すべて100% | 合格（100% / 100% / 100% / 100%、テスト75件全通過） |
| NT-04 | ビルド | `npm run build` | 本番ビルド成功、`/api/[[...route]]` が動的ルートとして生成される | 合格（`/` 静的 12.8kB / First Load 99.9kB） |
| NT-05 | N1 単一情報源 | features・画面・API に上限/閾値リテラルがないことを grep で確認 | リテラルなし（CONFIG参照のみ） | 合格（該当なし） |
| NT-06 | N1 feature間依存 | features 配下の相互 import を grep で確認 | 直接 import なし（shared経由のみ） | 合格（該当なし） |
| NT-07 | 秘密情報管理 | `.env` が gitignore 対象で履歴に含まれないことを確認 | `git check-ignore` で無視され、履歴に存在しない | 合格 |
| NT-08 | Git規律 | マージコミットを除く全コミットが1ファイルのみ変更 | 違反なし | 合格（最終監査で確認） |

## 3. 総合判定
全項目合格。本番ビルド・API・画面の基本動作を確認した。
