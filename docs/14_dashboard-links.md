# ダッシュボード自動ログイン（使用量ページへのリンク）

対象ブランチ: `feature/dashboard-links`
実装日: 2026-11-19

## 1. 概要

各サービスカードに「使用量ページを開く」ボタン（`CONFIG.dashboardLinkLabel`）を追加した。ボタンはカタログの `dashboardUrl`（`ServiceDef` の任意フィールド、定義は `src/shared/config/catalog.ts` のみが正）を新しいタブで開く（`target="_blank"`、`rel="noopener noreferrer"`）。描画は共通カード `src/shared/ui/service-card.tsx` の1か所のみで、全セクション（動画／画像／ローカル／GPU／音声）に一貫して表示される。`dashboardUrl` がないサービスにはボタン自体を表示しない。

## 2. 「自動ログイン」のモデル（重要）

**このアプリは、どのサービスのパスワードも保存しない。** 自動ログインとは次のモデルを指す：

1. ユーザーは普段使うブラウザで各サービスにログイン済みである（ブラウザのセッション／保存済みログインが有効）。
2. カードのボタンを押すと、公式の使用量・課金ページが新しいタブで開く。
3. ログイン処理はブラウザ側の既存セッションが行うため、ユーザーは（セッションが有効な限り）再入力なしで使用量ページに到達できる。

つまりアプリが保持するのは **公式ページの URL だけ** であり、認証情報は一切扱わない。これは本プロジェクトの `.env` 方針（実値は git に入れず、プレースホルダのみ）と一貫する設計で、API トークン類も同様にアプリ本体には保存しない（リーダー用トークンは PC 側 `.env` のみ）。

## 3. 各サービスのリンク先と選定理由

選定ルール：調査ドキュメント（docs/09〜13、`~/workspace/quota-research/`）に使用量・課金ページとして記録された URL を優先する。深い URL の記録がない場合は公式アプリのトップを使う。出典のない深い URL は作らない。

| サービスID | リンク先 | 選定理由 |
|---|---|---|
| `runway` | https://app.runwayml.com | 調査で「ダッシュボード」として記録された Web アプリ本体。残高・プランはアプリ内の Plans & Billing で確認する |
| `kling` | https://kling.ai/app/membership/membership-plan | 調査でダッシュボードとして記録されたメンバーシップ／クレジットページそのもの |
| `luma` | https://lumalabs.ai/dream-machine | 調査でダッシュボードとして記録された Dream Machine 本体 |
| `hailuo` | https://hailuoai.video/subscribe | 調査でダッシュボードとして記録されたクレジット確認ページ |
| `pixverse` | https://app.pixverse.ai/subscribe | 調査でダッシュボードとして記録されたサブスク／クレジットページ |
| `pika` | https://pika.art/ | 調査でダッシュボードとして記録された Pika Create 本体（Credits/Subscription はアプリ内） |
| `crano` | https://crano.ai/ | 残高はログイン後のアプリ内にのみ表示され、専用ページの記録がないため公式トップ |
| `viyou` | https://viyou.ai/ | 残高はログイン後に確認する形式で、専用ページの記録がないため公式トップ |
| `civitai` | https://civitai.com/ | Buzz 残高・日次報酬はログイン後の Buzz Dashboard にのみ掲載されるため公式トップ（docs/13） |
| `mage` | https://www.mage.space/ | Gems 残高はログイン後のアプリ内に表示されるため公式トップ |
| `codex` | https://chatgpt.com/codex/settings/usage | Codex の使用量専用ページ（5時間枠・週間枠・リセット日時の確認先。docs/09、調査 `coding-tools-quota.md`） |
| `kaggle` | https://www.kaggle.com/settings | 調査でダッシュボードとして記録された設定ページ（GPU/TPU 割り当ての確認導線） |
| `kaggle-tpu` | https://www.kaggle.com/settings | GPU と同一アカウント・同一設定ページのため同じ URL |
| `modal` | https://modal.com/settings | 設定起点の URL（Usage & Billing への導線。Starter はダッシュボード確認が基本：docs/11） |
| `colab` | https://colab.research.google.com/ | 使用状況は Colab UI 内（Resources パネル）でのみ確認できるため公式トップ（docs/13） |
| `elevenlabs` | https://elevenlabs.io/app/subscription | 調査でダッシュボードとして記録されたサブスクリプション／使用クレジットページ |

### リンクを持たないサービス

| サービスID | 理由 |
|---|---|
| `antigravity` | ローカルのみで確認するツールであり、Web の使用量ダッシュボードが存在しない（調査 `coding-tools-quota.md`） |
| `muse` | Web の使用量ダッシュボードの記録がなく、状態は対話側で管理するため |

## 4. 制限事項

- **ブラウザのセッションが前提。** そのブラウザで対象サービスにログインしていない場合、まずサービス側のログインページが表示される（例：新規ブラウザで Codex を開くと ChatGPT のログインが先に求められる）。アプリ側でこれを回避する手段はなく、パスワードを保存しない設計上、それが正しい挙動である。
- セッションの有効期限切れ・別アカウントでログイン中の場合は、表示される使用量もそのアカウントのものになる。カードのアカウント表示（Muse の「メイン」等）とブラウザ側ログインアカウントの対応はユーザーが確認する。
- リンク先は各サービスの公式ページであり、URL が将来変わる可能性がある。変更に気づいたら `catalog.ts` の該当エントリだけを直す（URL の正はカタログのみ）。

## 5. テスト

- `tests/catalog.test.ts`:
  - リンクラベル `CONFIG.dashboardLinkLabel` が「使用量ページを開く」であること。
  - クレジット制の全12サービス（runway / kling / luma / hailuo / pixverse / pika / elevenlabs / modal / crano / viyou / civitai / mage）に https の `dashboardUrl` があること。
  - `dashboardUrl` がある場合はすべて整形式の https URL であること。
  - 主要サービスのリンク先が記録どおりの使用量・課金ページであること（codex / modal / elevenlabs / kling / kaggle / kaggle-tpu / colab）。
  - ローカルのみのサービス（antigravity / muse）に `dashboardUrl` がないこと。
- 対象範囲（`src/shared/lib` + `src/shared/config`）のカバレッジ 100% を維持。
