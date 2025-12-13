# Memory Policy（メモリ管理方針）

このプロジェクトでは、**判断の再現性**と**検索性**を重視してメモリを扱います。
「議事録」ではなく、**次回同じ状況で同じ判断ができるSSOT**を残すのが目的です。

---

## 1) SSOT（Gitで共有するもの）

以下は **Single Source of Truth（単一の正）** として扱い、基本はコミット対象にします。

- `.claude/memory/decisions.md`  
  - **重要な意思決定（ADR寄り）**を残す
  - 形式: 結論 / 背景 / 選択肢 / 採用理由 / 影響 / 見直し条件
- `.claude/memory/patterns.md`  
  - **再利用できる解法（パターン）**を残す
  - 形式: 問題 / 解法 / 適用条件 / 非適用条件 / 例 / 注意点

> 迷ったら：**“判断（Why）”は decisions、 “やり方（How）”は patterns** に寄せる。

---

## 2) ローカル（Gitに入れない推奨）

以下は**個人の作業ログ/状態**であり、原則コミット不要です（ノイズ/肥大化しやすい）。

- `.claude/state/`（セッション状態・変更履歴など）
- `.claude/memory/session-log.md`（セッションログ）
- `.claude/memory/context.json`（プロジェクト文脈の補助。必要ならローカル）
- `.claude/memory/archive/`（ローテーション/アーカイブ）

推奨 `.gitignore`（必要に応じて調整）:

```gitignore
# Claude Memory Policy (recommended)
# - Keep (shared SSOT): .claude/memory/decisions.md, .claude/memory/patterns.md
# - Ignore (local): .claude/state/, session-log.md, context.json, archives
.claude/state/
.claude/memory/session-log.md
.claude/memory/context.json
.claude/memory/archive/
```

---

## 3) 検索性（Index + Tags）

`decisions.md` / `patterns.md` は **先頭に Index** を置き、各エントリに **タグ**を付けます。

- タグ例: `#decision` `#pattern` `#db` `#distributed` `#ci` `#hooks` `#security` `#performance`
- ルール:
  - **1エントリ1タイトル**（検索の起点）
  - タイトル行に**タグを含める**（ripgrep/検索で拾いやすい）
  - Index は「日付: タイトル #tags」形式を推奨

---

## 4) 運用（昇格ルール）

- セッション中に出た内容は、まずはその場のメモでOK
- **重要な決定**は `decisions.md` に昇格
- **再利用できる解法**は `patterns.md` に昇格
- ログ肥大化は `/cleanup`（特に sessions）で整理

関連:
- `/remember`（Rules/Commands/Skills/Memoryへ適切に記録）
- `skills/session-memory`（セッション間の記憶運用）


