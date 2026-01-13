# タスク: review-security

## 概要
セキュリティ機能を計画・実装・レビューする。

## ワークフローモード
このタスクは Plan → Work → Review の3ステップで評価されます。

## プロンプト

```
認証ハンドラーを実装してください。

要件:
- JWT トークンの検証
- ユーザー認証ミドルウェア
- 権限チェック機能（admin/user）
- セッション無効化

技術スタック: TypeScript, Express
出力先: src/api/auth-handler.ts

セキュリティベストプラクティスに従って実装してください。
```

## 期待される出力

### Plan ステップ
- セキュリティ機能の実装計画が Plans.md に追加される

### Work ステップ
- `src/api/auth-handler.ts` が作成される
- JWT 検証・認証ミドルウェアが実装される

### Review ステップ
- セキュリティ問題が Severity 付きで出力される
- 重点項目: SQL インジェクション, XSS, 認証・認可, 機密情報

## 成功基準
| 基準 | 条件 |
|------|------|
| ファイル作成 | auth-handler.ts が存在 |
| セキュリティ機能 | JWT 検証が実装されている |
| レビュー出力 | Severity: Critical/High/Medium/Low が含まれる |

## 測定ポイント
- 全ステップの合計時間
- 検出されたセキュリティ問題数
- Critical/High の問題数
