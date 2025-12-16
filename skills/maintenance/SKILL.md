---
name: maintenance
description: "ファイルの整理・クリーンアップ。Plans.mdやログが肥大化した場合に使用。"
allowed-tools: ["Read", "Write", "Edit", "Bash"]
metadata:
  skillport:
    category: maintenance
    tags: [cleanup, archive, maintenance]
    alwaysApply: false
---

# Maintenance Skills

ファイルのメンテナンス・クリーンアップを担当するスキル群です。

---

## 発動条件

- 「ファイルを整理して」
- 「アーカイブして」
- 「古いタスクを移動して」
- `/cleanup`

---

## 含まれる小スキル

| スキル | 用途 |
|--------|------|
| ccp-auto-cleanup | Plans.md, session-log 等の自動整理 |

---

## ルーティングロジック

### ファイル整理が必要な場合

→ `ccp-auto-cleanup/doc.md` を参照

---

## 実行手順

1. ユーザーのリクエストを確認
2. `ccp-auto-cleanup/doc.md` を読む
3. その内容に従って実行
