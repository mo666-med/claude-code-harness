---
description: CI用・非対話のレビュー実行（ベンチマーク専用）
description-en: CI-only non-interactive review (benchmark use)
---

# /harness-review-ci - CI専用レビュー実行

**ベンチマーク専用**: 変更内容を非対話でレビューし、機械採点可能な形式で出力します。

## 制約（CI用）

- **AskUserQuestion 禁止**: 質問せずに進める
- **WebSearch 禁止**: 外部検索なしで進める
- **確認プロンプト禁止**: 自動で完了まで進める
- **修正適用禁止**: レビュー結果の報告のみ（修正は行わない）

## 入力

`benchmarks/test-project/` 配下の変更ファイルを検出。

## 出力形式（機械採点用）

**必須**: 各指摘に `Severity:` 行を含める。

```
## Review Result

### Summary
- Files Reviewed: 5
- Total Issues: 3
- Critical: 0
- High: 1
- Medium: 2
- Low: 0

### Issues

#### Issue 1
- File: src/utils/helper.ts
- Line: 25
- Severity: High
- Category: Security
- Description: SQL injection vulnerability in query construction
- Suggestion: Use parameterized queries

#### Issue 2
- File: src/index.ts
- Line: 42
- Severity: Medium
- Category: Quality
- Description: Missing error handling for async operation
- Suggestion: Add try-catch block

#### Issue 3
- File: src/components/Form.tsx
- Line: 15
- Severity: Medium
- Category: Accessibility
- Description: Button missing aria-label
- Suggestion: Add aria-label for screen readers

### Pass/Fail
- Result: PASS
- Reason: No critical issues found
```

## Severity 定義

| Severity | 基準 |
|----------|------|
| Critical | セキュリティ脆弱性、データ損失リスク |
| High | 重大なバグ、パフォーマンス問題 |
| Medium | コード品質、ベストプラクティス違反 |
| Low | スタイル、軽微な改善点 |

## 成功基準

- レビュー結果が出力されている
- 各指摘に Severity が付与されている
- Summary セクションに集計がある
- Pass/Fail 判定がある

## 採点ロジック

- **PASS**: Critical が 0 かつ High が 2 以下
- **FAIL**: Critical が 1 以上、または High が 3 以上

## 失敗時

- エラーをログに出力して終了
- レビュー対象がない場合は「No files to review」と報告
