# /setup-2agent - 2エージェント体制セットアップ

Cursor (PM) と Claude Code (Worker) の2エージェント体制を一発でセットアップします。
両方のエージェントに必要なファイルを自動生成します。

---

## このコマンドの特徴

- 🎯 **ワンコマンドセットアップ**: 必要なファイルを全て自動生成
- 📁 **Cursor側設定も生成**: `.cursor/` にPM用コマンドを配置
- 📋 **Plans.md 自動作成**: 初期タスクリスト付き
- 🔗 **連携準備完了**: すぐに2エージェント体制で作業開始可能

---

## 使い方

```
/setup-2agent
```

または自然言語で：
- 「2エージェント体制をセットアップして」
- 「Cursorと連携できるようにして」

---

## 生成されるファイル

### Claude Code 側

```
./
├── AGENTS.md           # 開発フロー概要（両エージェント共通）
├── CLAUDE.md           # Claude Code 専用設定
├── Plans.md            # タスク管理（共有）
└── .claude/
    └── memory/         # セッション記憶用
        ├── session-log.md
        ├── decisions.md
        └── patterns.md
```

### Cursor 側

```
.cursor/
└── commands/
    ├── assign-to-cc.md      # タスク依頼コマンド
    └── review-cc-work.md    # 完了レビューコマンド
```

---

## 実行フロー

### Phase 1: 現状確認

```bash
# 既存ファイルをチェック
[ -f AGENTS.md ] && echo "AGENTS.md: 既存"
[ -f Plans.md ] && echo "Plans.md: 既存"
[ -d .cursor ] && echo ".cursor/: 既存"
```

### Phase 2: AGENTS.md 生成

```markdown
# AGENTS.md - 2エージェント開発フロー

## 概要

このプロジェクトは2つのAIエージェントが協調して開発を進めます：

| エージェント | 役割 | 担当 |
|-------------|------|------|
| **Cursor (PM)** | プロジェクト管理 | 計画・レビュー・本番デプロイ |
| **Claude Code (Worker)** | 実装担当 | コーディング・テスト・stagingデプロイ |

## ワークフロー

1. Cursor でタスクを計画・依頼 (`/assign-to-cc`)
2. Claude Code で実装 (`/start-task`)
3. Claude Code から完了報告 (`/handoff-to-cursor`)
4. Cursor でレビュー・承認 (`/review-cc-work`)
5. 本番デプロイ（Cursor判断）

## コミュニケーション

- **Plans.md**: タスク状態の共有
- **マーカー**: `cursor:依頼中` → `cc:WIP` → `cc:完了` → `cursor:確認済`
```

### Phase 3: Plans.md 生成

```markdown
# Plans.md

## 📋 プロジェクト概要

**プロジェクト名**: {{PROJECT_NAME}}
**開始日**: {{DATE}}
**ステータス**: セットアップ完了

---

## 🔴 フェーズ1: 初期セットアップ `cc:完了`

- [x] 2エージェント体制セットアップ `cc:完了`
- [ ] 環境変数の設定 `cc:TODO`
- [ ] 基本構造の確認 `cc:TODO`

## 🟡 フェーズ2: 開発開始 `cc:TODO`

- [ ] 機能1の実装
- [ ] 機能2の実装

---

## 📝 備考

Cursor で `/assign-to-cc` を使ってタスクを依頼してください。
```

### Phase 4: Cursor コマンド配置

```bash
mkdir -p .cursor/commands
# templates/cursor/commands/ からコピー
```

### Phase 5: メモリ構造作成

```bash
mkdir -p .claude/memory
echo "# Session Log" > .claude/memory/session-log.md
echo "# Decisions" > .claude/memory/decisions.md
echo "# Patterns" > .claude/memory/patterns.md
```

---

## 完了メッセージ

```
✅ 2エージェント体制のセットアップが完了しました！

📁 生成されたファイル:
- AGENTS.md (開発フロー)
- CLAUDE.md (Claude Code設定)
- Plans.md (タスク管理)
- .cursor/commands/ (Cursorコマンド)
- .claude/memory/ (セッション記憶)

🚀 次のステップ:

【Cursor側】
1. `.cursor/commands/` のコマンドを確認
2. `/assign-to-cc` でタスクを依頼

【Claude Code側】
1. `/start-task` で作業開始
2. 完了後は `/handoff-to-cursor`

💡 困ったら「どうすればいい？」と聞いてください
```

---

## VibeCoder向け案内

| やりたいこと | どちらで言う | 言い方 |
|-------------|-------------|--------|
| タスクを依頼 | Cursor | 「〇〇を実装して」→ `/assign-to-cc` |
| 実装する | Claude Code | 「次のタスク」→ `/start-task` |
| 完了報告 | Claude Code | 「終わった」→ `/handoff-to-cursor` |
| レビュー | Cursor | 「確認して」→ `/review-cc-work` |

---

## 注意事項

- 既存の AGENTS.md, Plans.md がある場合は上書き確認
- Cursor のカスタムコマンドは `.cursor/commands/` に配置
- Plans.md は両エージェントで共有・編集
