---
name: worker
description: "Executes implementation tasks including coding, testing, and reviewing. Use when user mentions '実装', 'implement', 'テスト', 'test', 'レビュー', 'review', 'コードレビュー', 'セルフレビュー', 'ビルド', 'build', '品質チェック', or asks to implement features, write tests, or review code."
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
metadata:
  skillport:
    category: worker
    tags: [implementation, testing, review, build]
    alwaysApply: false
---
# Worker Skills

実際のタスク実行を担当するスキル群です。

---

## 発動条件

- `/work` コマンド実行時
- Plans.md のタスク実行時
- コードレビュー時
- ビルド/テスト実行時

---

## 含まれる小スキル

### 実装系

| スキル                | 用途               |
| --------------------- | ------------------ |
| ccp-work-impl-feature | 機能の実装         |
| ccp-work-write-tests  | テストコードの作成 |

### レビュー系

| スキル                   | 用途                     |
| ------------------------ | ------------------------ |
| ccp-review-changes       | 変更内容のレビュー       |
| ccp-review-quality       | コード品質チェック       |
| ccp-review-security      | セキュリティレビュー     |
| ccp-review-performance   | パフォーマンスレビュー   |
| ccp-review-accessibility | アクセシビリティチェック |
| ccp-review-aggregate     | レビュー結果の集約       |
| ccp-review-apply-fixes   | レビュー指摘の適用       |

### 検証系

| スキル             | 用途       |
| ------------------ | ---------- |
| ccp-verify-build   | ビルド検証 |
| ccp-error-recovery | エラー復旧 |

### ドキュメント系

| スキル                         | 用途             |
| ------------------------------ | ---------------- |
| ccp-docs-notebooklm-slide-yaml | スライドYAML生成 |

---

## ルーティングロジック

### 実装タスク

```
「機能を実装して」→ ccp-work-impl-feature/doc.md
「テストを書いて」→ ccp-work-write-tests/doc.md
```

### レビュータスク

```
「レビューして」→ ccp-review-changes/doc.md
「セキュリティチェック」→ ccp-review-security/doc.md
「パフォーマンス確認」→ ccp-review-performance/doc.md
「アクセシビリティ確認」→ ccp-review-accessibility/doc.md
「指摘を直して」→ ccp-review-apply-fixes/doc.md
```

### 検証タスク

```
「ビルドして」→ ccp-verify-build/doc.md
「エラーを直して」→ ccp-error-recovery/doc.md
```

---

## 実行手順

1. タスクの種類を判別（実装/レビュー/検証）
2. 適切な小スキルの doc.md を読む
3. その内容に従って実行
