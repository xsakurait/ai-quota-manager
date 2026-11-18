# API設計書

共通項目は `00_common.md` を参照する。エラー方針は C-6、データモデルは `02_er-diagram.md` を参照する。

## 1. ベース
- 実装: Hono（`src/app/api/[[...route]]/route.ts`）
- ベースパス: `/api`
- レスポンス形式: JSON。成功時は各エンドポイントの形式、エラー時は `{ "error": { "code": string, "message": string } }`。

## 2. エンドポイント一覧
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/catalog` | サービス定義一覧と共通設定メタ情報を返す |
| GET | `/api/catalog/:id` | サービス定義1件を返す |
| POST | `/api/usage/validate` | 使用量入力の検証とクランプ結果を返す |
| GET | `/api/status` | 使用量クエリから全サービスの状態集計を返す |

## 3. 各エンドポイント詳細
### GET /api/catalog
- リクエスト: なし。クエリ `kind`（video/local）で絞り込み、`q` で名前検索が可能。
- レスポンス 200: `{ services: Service[], config: { storageKey, thresholds, statusLabels, kindLabels, cycleLabels } }`（値は共通設定 C-2 由来）。
- エラー: なし（絞り込み結果0件でも 200 で空配列）。

### GET /api/catalog/:id
- レスポンス 200: `{ service: Service }`。
- エラー 404: `{ error: { code: "SERVICE_NOT_FOUND", message: string } }`。

### POST /api/usage/validate
- リクエストJSON: `{ serviceId: string, used: unknown }`。
- レスポンス 200: `{ serviceId, used: number（クランプ済）, remaining, usagePercent, status }`。
- エラー 400: JSON不正または serviceId 欠落時 `{ error: { code: "INVALID_BODY", ... } }`。
- エラー 404: サービスが存在しない場合（SERVICE_NOT_FOUND）。

### GET /api/status
- クエリ: `used_<serviceId>=<number>` 形式で各サービスの使用量を任意指定（未指定は0）。
- レスポンス 200: `{ summary: { count, used, limit, exhausted }, items: [{ serviceId, remaining, usagePercent, status, nextReset }] }`。
- エラー: なし。

## 4. 備考
- APIはサーバー側に使用量を永続化しない。永続化はクライアントの localStorage（C-5）が担う。
- 上限・閾値などの値はすべて共通設定（C-2）から取得し、API層にリテラルを持たない。
