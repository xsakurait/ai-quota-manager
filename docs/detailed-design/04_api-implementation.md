# 詳細設計書 04 API実装

共通項目は `00_index-and-common.md` および基本設計 API設計書・C-6 を参照する。

## 対象モジュール
`src/app/api/[[...route]]/route.ts`（Hono アプリケーション）

## 実装詳細
- Hono の `basePath('/api')` でルーティングし、GET/POST ハンドラを Next.js の Route Handler として公開する。
- `/catalog`: filterServices を用いて `kind` / `q` クエリを適用し、共通設定のメタ情報とともに返す。
- `/catalog/:id`: findService で検索し、見つからなければ C-6 に従い 404（SERVICE_NOT_FOUND）を返す。
- `/usage/validate` (POST): JSON解析に失敗した場合は 400（INVALID_BODY）。serviceId が文字列でない場合も 400。サービスが存在しない場合は 404。通過時は clampUsage と buildStatus 相当の計算結果を返す。
- `/status`: クエリ `used_<id>` を数値化（不正値は0）して使用量マップを構築し、summarize と buildStatus の一覧を返す。
- API層は上限・閾値のリテラルを持たず、すべて共通設定と純粋ロジック経由で取得する。
