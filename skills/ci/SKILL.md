---
name: ci
description: "CI/CD パイプラインの問題を解決する。GitHub Actions、GitLab CI 等でビルドやテストが失敗した場合に使用。"
allowed-tools: ["Read", "Grep", "Bash"]
metadata:
  skillport:
    category: ci
    tags: [ci-cd, github-actions, pipeline, debugging]
    alwaysApply: false
---

# CI/CD Skills

CI/CD パイプラインに関する問題を解決するスキル群です。

---

## 発動条件

- 「CIが落ちた」「GitHub Actionsが失敗」
- 「ビルドエラー」「テストが通らない」
- 「パイプラインを直して」

---

## 含まれる小スキル

| スキル | 用途 | トリガー |
|--------|------|----------|
| ccp-ci-analyze-failures | 失敗原因の分析 | 「ログを見て」「原因を調べて」 |
| ccp-ci-fix-failing-tests | テスト修正の提案 | 「テストを直して」「修正案を出して」 |

---

## ルーティングロジック

ユーザーの意図に応じて適切な小スキルを選択:

### 分析・調査が必要な場合

→ `ccp-ci-analyze-failures/doc.md` を参照

例:
- 「CIが落ちた原因を教えて」
- 「GitHub Actionsのログを見て」
- 「なんでビルドが失敗したの？」

### 修正・対応が必要な場合

→ `ccp-ci-fix-failing-tests/doc.md` を参照

例:
- 「テストを直して」
- 「エラーを修正して」
- 「パイプラインを通るようにして」

---

## 実行手順

1. ユーザーの意図を分類（分析 or 修正）
2. 適切な小スキルの doc.md を読む
3. その内容に従って実行
