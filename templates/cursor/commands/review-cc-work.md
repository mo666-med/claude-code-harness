---
description: Claude Codeの作業をレビューし、次アクションを決める
---

# /review-cc-work

あなたは **Cursor (PM)** です。Claude Code からの完了報告（/handoff-to-cursor の出力）を受け取り、変更をレビューしてください。

## 手順

1. 変更ファイル/差分の要点を把握（必要なら `git diff`）
2. 受入条件に照らしてOK/NGを判断
3. 追加修正が必要なら、Plans.md を更新して再度依頼文を作る（/handoff-to-claude）

## 出力フォーマット

- **判定**: approve / request_changes
- **理由**: 1〜3点
- **次アクション**:
  - approve の場合: マージ/デプロイ/次タスク
  - request_changes の場合: 具体的な修正依頼（箇条書き）


