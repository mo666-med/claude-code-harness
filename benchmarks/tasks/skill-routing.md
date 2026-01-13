# タスク: skill-routing

## 概要
スキル評価フローを含む複合タスクを計画・実装・レビューする。

## ワークフローモード
このタスクは Plan → Work → Review の3ステップで評価されます。
適切なスキルが自動的に選択・起動されるかを測定。

## プロンプト

```
日付ユーティリティを実装してください。

要件:
1. ユーティリティ関数: src/utils/date-helpers.ts
   - formatDate(date: Date, format: string): string
   - parseDate(str: string): Date
   - isValidDate(date: any): boolean

2. テスト: src/utils/__tests__/date-helpers.test.ts
   - 各関数の正常系・異常系テスト
   - エッジケース（無効な日付、境界値）

3. 最後に作成したコードの品質をレビュー

各フェーズで適切なスキルを活用してください。
```

## 期待される出力

### Plan ステップ
- 実装・テスト・レビューの計画が Plans.md に追加される

### Work ステップ
- date-helpers.ts が作成される
- テストファイルが作成される

### Review ステップ
- 作成コードの品質レビューが Severity 付きで出力される
- impl, verify, review スキルが起動される（transcript で検出）

## 成功基準
| 基準 | 条件 |
|------|------|
| 実装 | 3関数が定義 |
| テスト | 各関数にテスト |
| レビュー | Severity 付きの出力 |
| スキル起動 | CI専用コマンドが使用される |

## 測定ポイント
- 全ステップの合計時間
- スキル起動の有無（transcript grader）
- タスク間の連携品質
