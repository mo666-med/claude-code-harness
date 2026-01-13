# タスク: impl-refactor

## 概要
レガシーコードを計画的にリファクタリング・レビューする。

## ワークフローモード
このタスクは Plan → Work → Review の3ステップで評価されます。

## プロンプト

```
レガシー JavaScript コードを TypeScript にリファクタリングしてください。

要件:
- JavaScript → TypeScript 変換
- 適切な型定義の追加（interface/type）
- エラーハンドリングの改善（try-catch）
- 関数の分割（1関数1責務）

対象: src/legacy/user-service.js がある場合はそれを変換
ない場合は、サンプルのレガシーコードを作成してからリファクタリング

出力先: src/services/user-service.ts
```

## 期待される出力

### Plan ステップ
- リファクタリング計画が Plans.md に追加される

### Work ステップ
- TypeScript ファイルが作成される
- 型定義・エラー処理が追加される

### Review ステップ
- リファクタリング品質の指摘が Severity 付きで出力される

## 成功基準
| 基準 | 条件 |
|------|------|
| ファイル作成 | TypeScript ファイルが存在 |
| 型定義 | interface/type が定義されている |
| レビュー | Severity 付きの出力がある |

## 測定ポイント
- 全ステップの合計時間
- 編集操作の回数
- 検出された問題数
