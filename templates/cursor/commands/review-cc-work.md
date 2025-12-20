---
description: Claude Codeの作業をレビューし、次アクションを決める
---

# /review-cc-work

あなたは **Cursor (PM)** です。Claude Code からの完了報告（/handoff-to-cursor の出力）を受け取り、変更をレビューしてください。

## 手順

1. 変更ファイル/差分の要点を把握（必要なら `git diff`）
2. 受入条件に照らしてOK/NGを判断
3. **承認できない場合（request_changes）**:
   - Plans.md に「修正タスク」を追記/更新（何を直すか・どの受入条件に紐づくかが分かる粒度）
   - 続けて **`/claude-code-harness/handoff-to-claude` を実行**し、Claude Code に渡す依頼文を生成
   - 生成した依頼文を、あなたの返信の末尾に **そのまま貼り付け**（コピー&ペースト可能な形）

## 出力フォーマット

- **判定**: approve / request_changes
- **理由**: 1〜3点
- **次アクション**:
  - approve の場合: マージ/デプロイ/次タスク
  - request_changes の場合: 具体的な修正依頼（箇条書き）
- **`/claude-code-harness/handoff-to-claude` 出力**（request_changes の場合は必須）:

```markdown
## 依頼
以下を実装してください。

- 対象タスク:
  - （Plans.md に追記/更新した修正タスクを列挙）

## 制約
- 既存のコードスタイルに従う
- 変更は必要最小限
- テスト/ビルド手順があれば提示

## 受入条件
- （3〜5個）

## 参考
- 関連ファイル（あれば）
```


