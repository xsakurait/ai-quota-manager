# 無料枠管理アプリ（AI動画＋ローカルエージェント）

AI動画生成サービスとローカルエージェントの無料枠を1画面で管理する Next.js + Hono アプリです。

## セットアップ
```bash
cp .env.sample .env
npm install
npm run dev
```

## スクリプト
- `npm run lint` / `npm run typecheck` / `npm run test:coverage` / `npm run build`

## ドキュメント
- 要件: `docs/01_requirements.md`
- 基本設計: `docs/basic-design/`
- 詳細設計: `docs/detailed-design/`
- テスト: `docs/05_unit-test-viewpoints.md`, `docs/06_system-test.md`, `docs/07_test-report.md`

無料枠の定義は `src/shared/config/catalog.ts` が唯一の情報源です。
