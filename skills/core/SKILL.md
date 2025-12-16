---
name: core
description: "Claude Code Harness の中核機能。プロジェクト設定、ワークフローファイル生成、メモリ管理など基盤となるスキル群。"
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
metadata:
  skillport:
    category: core
    tags: [setup, workflow, memory, project]
    alwaysApply: false
---

# Core Skills

Claude Code Harness の中核となるスキル群です。

---

## 発動条件

- プロジェクトセットアップ時
- ワークフローファイル生成時
- SSOT/メモリ初期化時

---

## 含まれる小スキル

### セットアップ系

| スキル | 用途 |
|--------|------|
| ccp-adaptive-setup | プロジェクト状況に応じた適応的セットアップ |
| ccp-project-scaffolder | 新規プロジェクトのスキャフォールディング |
| ccp-generate-workflow-files | CLAUDE.md, AGENTS.md, Plans.md 生成 |
| ccp-generate-claude-settings | .claude/settings.json 生成 |
| ccp-setup-2agent-files | 2-Agent 運用用ファイル設定 |
| ccp-update-2agent-files | 2-Agent ファイルの更新 |
| ccp-migrate-workflow-files | 旧形式からの移行 |

### メモリ/SSOT 系

| スキル | 用途 |
|--------|------|
| ccp-init-memory-ssot | decisions.md, patterns.md 初期化 |
| ccp-merge-plans | Plans.md のマージ処理 |

### 原則/ガイドライン系

| スキル | 用途 |
|--------|------|
| ccp-core-general-principles | 開発の基本原則 |
| ccp-core-diff-aware-editing | 差分認識編集 |
| ccp-core-read-repo-context | リポジトリコンテキスト読み取り |
| ccp-vibecoder-guide | VibeCoder 向けガイド |

---

## ルーティングロジック

### 新規セットアップ

→ `ccp-adaptive-setup/doc.md` → 状況判断 → 適切なセットアップスキル

### ファイル生成

→ `ccp-generate-workflow-files/doc.md` または `ccp-generate-claude-settings/doc.md`

### 2-Agent 運用

→ `ccp-setup-2agent-files/doc.md` または `ccp-update-2agent-files/doc.md`

### 基本原則の参照

→ `ccp-core-general-principles/doc.md`

---

## 実行手順

1. ユーザーのリクエストを分類
2. 適切な小スキルの doc.md を読む
3. その内容に従って実行
