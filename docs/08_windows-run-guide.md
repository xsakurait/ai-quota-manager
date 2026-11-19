# Windows での実行ガイド（Volta / Node.js）

このアプリを Windows PC（muse-ai ユーザー）で動かすための手順と、実機検証の記録です。

## 前提
- Windows 11（build 22631）、配置先: `C:\Users\muse-ai\Desktop\ai-video-local-quota-manager`
- Node.js は Volta 2.0.2 で管理します（Docker は使いません）。
  - Volta 本体: `C:\Program Files\Volta\volta.exe`
  - Node 未導入の場合は `volta install node` の1コマンドで入ります。

## セットアップと起動
```bat
cd C:\Users\muse-ai\Desktop\ai-video-local-quota-manager
copy .env.sample .env
npm ci
npm run dev
```
`.env` は `.env.sample` から作るローカル専用ファイルです。`.gitignore` で除外されているため、GitHub へは上がりません。

## 実機検証結果（2026-11-19、Windows 上で実施）
| 項目 | 結果 |
|---|---|
| Volta | 2.0.2 |
| Node.js | v26.13.1（Volta 経由） |
| npm | 11.20.0 |
| `npm ci` | 成功（465 packages） |
| `npm run test:coverage` | 75件全通過、カバレッジ 100%（対象: `src/shared/lib` + `src/shared/config`） |
| `npm run lint` | 成功 |
| `npm run typecheck` | 成功 |
| `npm run build` | 成功（`/` 静的 12.8 kB、API ルート生成） |

## 補足
- GitHub への接続は Windows 側の専用 SSH 鍵（muse-ai-pc）を使い、アカウント xsakurait で認証します。
- 無料枠の定義変更は `src/shared/config/catalog.ts` のみを編集してください（共通設計の単一情報源）。
