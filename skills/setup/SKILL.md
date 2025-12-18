---
name: setup
description: "Sets up new projects and generates workflow files like CLAUDE.md, AGENTS.md, Plans.md. Use when user mentions セットアップ, setup, 初期化, initialize, 新規プロジェクト, ワークフローファイル生成."
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
metadata:
  skillport:
    category: setup
    tags: [setup, initialize, workflow, project]
    alwaysApply: false
---

# Setup Skills

プロジェクトセットアップとワークフローファイル生成を担当するスキル群です。

## 含まれる小スキル

| スキル | 用途 |
|--------|------|
| ccp-adaptive-setup | プロジェクト状況に応じた適応的セットアップ |
| ccp-project-scaffolder | 新規プロジェクトのスキャフォールディング |
| ccp-generate-workflow-files | CLAUDE.md, AGENTS.md, Plans.md 生成 |
| ccp-generate-claude-settings | .claude/settings.json 生成 |

## ルーティング

- 適応的セットアップ: ccp-adaptive-setup/doc.md
- スキャフォールディング: ccp-project-scaffolder/doc.md
- ワークフローファイル: ccp-generate-workflow-files/doc.md
- 設定ファイル: ccp-generate-claude-settings/doc.md

## 実行手順

1. ユーザーのリクエストを分類
2. 適切な小スキルの doc.md を読む
3. その内容に従ってセットアップ
