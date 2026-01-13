# タスク: impl-utility

## 概要
ユーティリティ関数を計画・実装・レビューする。

## ワークフローモード
このタスクは Plan → Work → Review の3ステップで評価されます。

## プロンプト

```
文字列操作のユーティリティ関数を実装してください。

要件:
- truncate(str, maxLength): 文字列を指定長で切り詰め "..." を付ける
- slugify(str): URL用スラッグに変換（小文字化、スペース→ハイフン）
- capitalize(str): 最初の文字を大文字にする

技術スタック: TypeScript
出力先: src/utils/string-helpers.ts
```

## 期待される出力

### Plan ステップ
- Plans.md に 3-5 個のタスクが追加される

### Work ステップ
- `src/utils/string-helpers.ts` が作成される
- 3つの関数が実装される

### Review ステップ
- 型定義・エラー処理の指摘が Severity 付きで出力される

## 成功基準
| 基準 | 条件 |
|------|------|
| ファイル作成 | string-helpers.ts が存在 |
| 関数数 | 3つの関数が定義 |
| レビュー | Severity 付きの出力がある |

## 測定ポイント
- 全ステップの合計時間
- ツール呼び出し回数
- 検出された問題数
