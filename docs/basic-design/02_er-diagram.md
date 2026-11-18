# 基本設計書 ER図（論理モデル）

本アプリは localStorage ベースであり物理DBは存在しないが、扱うデータを論理エンティティとしてモデル化する。共通項目は `00_common.md` を参照する。

```mermaid
erDiagram
    Service ||--o{ UsageRecord : "has"
    Service ||--|| QuotaStatus : "evaluated as"
    Service ||--|| ResetSchedule : "follows"
    Service {
        string id PK "サービスID（共通設定で定義）"
        string name "サービス名"
        string kind "種別: video / local"
        number limit "無料枠上限（共通設定のみ）"
        string unit "単位ラベル"
        string cycle "リセット周期"
        string note "備考"
    }
    UsageRecord {
        string serviceId FK "対象サービス"
        number used "記録された使用量"
        string updatedAt "最終更新（表示用）"
    }
    QuotaStatus {
        string serviceId FK "対象サービス"
        number remaining "残量"
        number usagePercent "使用率"
        string status "通常 / 注意 / 枯渇"
    }
    ResetSchedule {
        string serviceId FK "対象サービス"
        string cycle "周期種別"
        datetime nextReset "次回リセット日時"
    }
```

## エンティティ説明
- Service: 共通設定（C-2）に定義されるマスタ。実行時に追加・削除しない。
- UsageRecord: localStorage に保存される使用量（C-5）。Service 1件につき最大1件。
- QuotaStatus: Service と UsageRecord から都度算出する派生データ。永続化しない。
- ResetSchedule: Service の周期から都度算出する派生データ。永続化しない。
