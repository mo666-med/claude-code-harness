---
name: verify
description: "Verifies builds, recovers from errors, and applies review fixes. Use when user mentions ビルド, build, 検証, verify, エラー復旧, error recovery, 指摘を適用, apply fixes, テスト実行. Do NOT load for: 実装作業, レビュー, セットアップ, 新機能開発."
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
metadata:
  skillport:
    category: verify
    tags: [build, verify, error-recovery, fixes]
    alwaysApply: false
---

# Verify Skills

ビルド検証とエラー復旧を担当するスキル群です。

## 含まれる小スキル

| スキル | 用途 |
|--------|------|
| verify-build | ビルド検証 |
| error-recovery | エラー復旧 |
| review-aggregate | レビュー結果の集約 |
| review-apply-fixes | レビュー指摘の適用 |

## ルーティング

- ビルド検証: verify-build/doc.md
- エラー復旧: error-recovery/doc.md
- レビュー集約: review-aggregate/doc.md
- 指摘適用: review-apply-fixes/doc.md

## 実行手順

1. ユーザーのリクエストを分類
2. 適切な小スキルの doc.md を読む
3. その内容に従って検証/復旧実行
