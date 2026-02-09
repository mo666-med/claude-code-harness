---
name: vote
description: "3者合議制(PreToolUse hook連動)"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

# /vote - 3者合議制による自動承認

**目的**: 「次に進めますか？」「よいですか？」の確認を省略し、
**Claude / Codex / Gemini の合議で自動判断**してどんどん進める。

---

## いつ使うか

通常、Claudeは以下の場面でユーザー確認を求める:
- 「この方針でよいですか？」
- 「次のステップに進みますか？」
- 「この実装で問題ないですか？」

→ `/vote` により、これらを **3者合議で自動承認** し、確認待ちなしで進行

---

## 動作

```
Claude: 判断が必要な場面
    ↓
（従来）ユーザーに確認 → 待機
    ↓
（/vote後）3者合議 → 自動承認 → 即進行
```

---

## 合議メンバー

| メンバー | 役割 |
|----------|------|
| **Claude** | 実行者。一次判断 |
| **Codex** | セカンドオピニオン（設計/セキュリティ/品質） |
| **Gemini** | サードオピニオン（妥当性確認） |

---

## 承認ルール

| 一致度 | 結果 |
|--------|------|
| 3/3 承認 | 即進行 |
| 2/3 承認 | 進行（ログ記録） |
| 1/3 以下 | 停止、ユーザーに確認 |

---

## 除外（必ずユーザー確認）

以下は合議でも自動承認しない:

- 本番環境への変更
- `main`/`master` への force push
- システム全体に影響する削除
- 認証情報の操作
- 課金・決済に関わる変更

---

## 実行手順

### Step 1: 目的確認

```
/vote
    ↓
Claude: 「何を自動承認しますか？」（動的に選択肢生成）
```

コンテキストから推測した選択肢を提示。

### Step 2: スコープ設定

目的に基づいてスコープを設定:
- この目的に関連する判断は自動承認
- 目的外の判断は通常通りユーザー確認

### Step 3: 作業実行

確認が必要な場面で:
1. Claude が一次判断
2. Codex に委譲（並列）
3. Gemini に委譲（並列）
4. 結果を統合
5. 2/3以上で自動進行

### Step 4: 目的達成確認

目的達成後:
- 「達成しましたか？」
- はい → スコープ終了
- いいえ → 継続

---

## 委譲コマンド

```bash
# Codex
node ~/.claude/skills/orchestra-delegator/scripts/delegate.js \
  -a [architect|code-reviewer|security-analyst] -t "[判断内容]"

# Gemini
node ~/.claude/skills/orchestra-delegator/scripts/delegate-gemini.js \
  -a ui-reviewer -t "[判断内容]"
```

---

## 参照

詳細ルール: `~/.claude/rules/dangerous-permission-consensus.md`
