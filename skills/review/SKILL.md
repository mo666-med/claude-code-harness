---
name: review
description: "Reviews code for quality, security, performance, and accessibility issues. Use when user mentions レビュー, review, コードレビュー, セキュリティ, パフォーマンス, 品質チェック, セルフレビュー, PR, diff, 変更確認. Do NOT load for: 実装作業, 新機能開発, バグ修正, セットアップ."
allowed-tools: ["Read", "Grep", "Glob", "Bash", "Task"]
metadata:
  skillport:
    category: review
    tags: [review, quality, security, performance, accessibility]
    alwaysApply: false
---

# Review Skills

コードレビューと品質チェックを担当するスキル群です。

## 含まれる小スキル

| スキル | 用途 |
|--------|------|
| review-changes | 変更内容のレビュー |
| review-quality | コード品質チェック |
| review-security | セキュリティレビュー |
| review-performance | パフォーマンスレビュー |
| review-accessibility | アクセシビリティチェック |

## ルーティング

ユーザーの意図に応じて適切な小スキルを選択:

- 一般的なレビュー: review-changes/doc.md
- 品質重視: review-quality/doc.md
- セキュリティ重視: review-security/doc.md
- パフォーマンス重視: review-performance/doc.md
- アクセシビリティ重視: review-accessibility/doc.md

## 実行手順

1. ユーザーのリクエストを分類
2. 並列実行の判定（下記参照）
3. 適切な小スキルの doc.md を読む、または並列サブエージェント起動
4. 結果を統合してレビュー完了

## 並列サブエージェント起動（推奨）

以下の条件を**両方**満たす場合、Task tool で code-reviewer を並列起動:

- レビュー観点 >= 2（例: セキュリティ + パフォーマンス）
- 変更ファイル >= 5

**起動パターン（1つのレスポンス内で複数の Task tool を同時呼び出し）:**

```
Task tool 並列呼び出し:
  #1: subagent_type="code-reviewer"
      prompt="セキュリティ観点でレビュー: {files}"
  #2: subagent_type="code-reviewer"
      prompt="パフォーマンス観点でレビュー: {files}"
  #3: subagent_type="code-reviewer"
      prompt="コード品質観点でレビュー: {files}"
```

**小規模な場合（条件を満たさない）:**
- 子スキル（doc.md）を順次読み込んで直列実行
