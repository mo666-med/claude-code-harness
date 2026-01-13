# タスク: multi-file-refactor

## 概要
複数ファイルにまたがるリファクタリングを計画・実装・レビューする。

## ワークフローモード
このタスクは Plan → Work → Review の3ステップで評価されます。
並列処理の効果が顕著に出るタスク。

## プロンプト

```
ユーザーサービスの完全なリファクタリングを実施してください。

要件:
1. 型定義ファイル: src/types/user.types.ts
   - User, CreateUserDTO, UpdateUserDTO インターフェース

2. エラークラス: src/errors/user.errors.ts
   - UserNotFoundError, ValidationError クラス

3. サービス本体: src/services/user.service.ts
   - CRUD 操作
   - async/await パターン
   - 適切なエラーハンドリング

4. テスト: src/services/__tests__/user.service.test.ts
   - 主要メソッドのユニットテスト

全ファイル間で整合性を保ってください。可能であれば並列で処理してください。
```

## 期待される出力

### Plan ステップ
- 4ファイルの作成計画が Plans.md に追加される

### Work ステップ
- 4つのファイルが作成される
- 型定義・エラークラス・サービス・テストが整合

### Review ステップ
- 各ファイルの品質問題が Severity 付きで出力される

## 成功基準
| 基準 | 条件 |
|------|------|
| ファイル数 | 4ファイル以上作成 |
| 型定義 | interface が定義 |
| テスト | describe/it が存在 |
| レビュー | Severity 付きの出力がある |

## 測定ポイント
- 全ステップの合計時間
- 並列処理の有無（Task tool 使用）
- 生成されたコード行数
