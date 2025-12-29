---
description: Cursor × Claude-mem 統合の完全セットアップ
description-en: Complete Cursor × Claude-mem integration setup
---

# Cursor × Claude-mem Integration Setup

このコマンドは Cursor IDE での claude-mem 統合を自動セットアップします。

## 概要

Cursor での作業内容を自動的に claude-mem に記録し、Claude Code との間で作業履歴を共有可能にします。

### 自動記録される内容

- **ユーザープロンプト**: Cursor Composer で送信したプロンプト
- **ファイル編集**: Cursor で編集したファイルの変更内容
- **セッション完了**: セッション終了時の状態

### 双方向データ共有

```
Claude Code ⇄ claude-mem ⇄ Cursor
自動記録      WAL モード    手動検索
```

### Cursor Rules フォーマット

このコマンドは **Cursor 公式推奨の新フォーマット** (`.cursor/rules/`) を使用します：

| フォーマット | ファイル | 状態 | 備考 |
|------------|---------|------|------|
| **新フォーマット** | `.cursor/rules/claude-mem.md` | ✅ 推奨 | YAML frontmatter 付き |
| レガシー | `.cursorrules` | ⚠️ 非推奨 | [公式で廃止予定](https://cursor.com/ja/docs/context/rules) |

新フォーマットの特徴：
- YAML frontmatter (`description`, `alwaysApply`) によるメタデータ管理
- 複数ルールファイルの組み合わせ可能
- Cursor 公式の長期サポート保証

## 実行内容

このコマンドは以下を自動実行します：

1. ✅ Worker 起動確認
2. ✅ MCP 設定スコープの確認と選択
3. ✅ MCP 設定の追加（必要に応じて）
4. ✅ フックスクリプト配置確認
5. ✅ hooks.json 生成
6. ✅ Cursor Rules 生成（.cursor/rules/claude-mem.md）
7. ✅ 簡易テスト実行
8. ✅ セットアップ成功確認

## 使用方法

### 基本的な使い方

```bash
# 対話的にスコープを選択
/cursor-mem
```

### オプション付き実行

```bash
# グローバル設定を強制（全プロジェクトで有効）
/cursor-mem --global

# プロジェクトローカル設定を強制（このプロジェクトのみ）
/cursor-mem --local

# テストをスキップ
/cursor-mem --skip-test

# 既存ファイルを上書き
/cursor-mem --force
```

## MCP 設定スコープ

### グローバル設定 (`~/.cursor/mcp.json`)

**メリット**:
- 全プロジェクトで claude-mem が利用可能
- 一度設定すれば全プロジェクトで有効

**デメリット**:
- すべてのプロジェクトで MCP サーバーが起動
- プロジェクト固有の設定ができない

**推奨**: 複数プロジェクトで claude-mem を使用する場合

### プロジェクトローカル設定 (`.cursor/mcp.json`)

**メリット**:
- このプロジェクトのみで有効
- 他のプロジェクトに影響しない
- プロジェクト固有の設定が可能

**デメリット**:
- プロジェクトごとに設定が必要

**推奨**: 特定のプロジェクトでのみ使用する場合

## セットアップ後の確認

### 自動検証（推奨）

すべての設定が正しいか一括でチェック:

```bash
./scripts/validate-cursor-mem.sh
```

このスクリプトは以下を検証します:
- ✅ Worker 起動状態
- ✅ MCP 設定の存在と構造
- ✅ フックスクリプトの存在と実行権限
- ✅ hooks.json の設定内容
- ✅ データベースとテーブル構造
- ✅ ドキュメントの存在

**SSOT (Single Source of Truth)**: この検証スクリプトがセットアップ検証の唯一の信頼できる情報源です。

### 手動確認（参考）

個別に確認したい場合:

#### 1. Worker の起動確認

```bash
curl http://127.0.0.1:37777/health
# 期待される出力: {"status":"ok"}
```

#### 2. Cursor での動作確認

1. Cursor を再起動
2. プロンプトを送信: "動作テスト"
3. ファイルを編集してみる

#### 3. 記録の確認

```bash
# 最新の記録を確認
./tests/cursor-mem/verify-records.sh --recent

# または SQLite で直接確認
sqlite3 ~/.claude-mem/claude-mem.db \
  "SELECT tool_name, title FROM observations
   ORDER BY created_at DESC LIMIT 5;"
```

期待される出力例:
```
UserPrompt|動作テスト
Edit|test.txt を編集
SessionStop|セッション完了
```

## トラブルシューティング

### 問題1: Worker が起動していない

**症状**: `curl http://127.0.0.1:37777/health` が失敗する

**解決策**:
```bash
# Worker を起動
claude-mem restart

# ステータス確認
curl http://127.0.0.1:37777/health
```

### 問題2: MCP ツールが認識されない

**症状**: Cursor で claude-mem MCP ツールが表示されない

**解決策**:
1. Cursor を完全に再起動
2. MCP 設定ファイルのパスを確認:
   ```bash
   # グローバル設定
   cat ~/.cursor/mcp.json

   # プロジェクトローカル設定
   cat .cursor/mcp.json
   ```
3. スクリプトのパスが正しいか確認

### 問題3: フックが動作しない

**症状**: プロンプトを送信してもデータベースに記録されない

**解決策**:
1. Cursor を再起動
2. `.cursor/hooks.json` が存在するか確認:
   ```bash
   cat .cursor/hooks.json
   ```
3. スクリプトが実行可能か確認:
   ```bash
   ls -la scripts/cursor-hooks/*.js
   ```

### 問題4: プロジェクト検出が正しくない

**症状**: 記録が別のプロジェクトに保存される

**解決策**:

MCP 設定で `cwd` と `env.CLAUDE_MEM_PROJECT_CWD` を確認:
```json
{
  "mcpServers": {
    "claude-mem": {
      "type": "stdio",
      "command": "/path/to/claude-mem-mcp",
      "cwd": "${workspaceFolder}",
      "env": {
        "CLAUDE_MEM_PROJECT_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

## 使用例

### 例1: 過去の作業を確認

Cursor Composer で:
```
過去の認証方式の選定理由を検索して
```

→ MCP ツールが自動的に claude-mem を検索

### 例2: 気付きを記録

Cursor Composer で:
```
このコンポーネント設計パターンを記録しておいて
```

→ MCP ツールが claude-mem に記録を保存

### 例3: Claude Code との連携

1. **Claude Code で実装**
   ```bash
   claude
   # 機能を実装
   ```

2. **Cursor でレビュー**
   - MCP ツールで Claude Code の記録を検索
   - レビュー結果を claude-mem に記録

3. **Claude Code で修正**
   - SessionStart で Cursor のレビュー結果を読み込み
   - 指摘事項を反映

## 制限事項

### 自動記録の制限

1. **自動コンテキスト注入は不可**: セッション開始時に手動で過去記録を検索する必要があります

2. **エージェント応答は記録されない**: Cursor のフック制限により、エージェントの応答は記録できません

3. **カバレッジ**: Claude Code での記録と比べて 60-70% 程度のカバレッジとなります

### カバレッジ比較

| 記録内容 | Claude Code | Cursor（自動記録） |
|---------|-------------|-------------------|
| ユーザープロンプト | ✅ 完全 | ✅ 完全 |
| ツール呼び出し | ✅ 完全 | ⚠️ 部分的 |
| ツール結果 | ✅ 完全 | ❌ なし |
| エージェント思考 | ✅ 完全 | ❌ なし |
| ファイル編集 | ✅ 完全 | ✅ 完全 |
| セッション完了 | ✅ 完全 | ✅ 完全 |

## ハーネスワークフローとの統合

Cursor × Claude-mem は、ハーネスの他のコマンドと連携して使用できます:

### セットアップフロー

```
/cursor-mem                   # Cursor 統合をセットアップ
  ↓
./scripts/validate-cursor-mem.sh  # 設定を検証
  ↓
/validate                     # プロジェクト全体を検証
```

### 開発フロー

```
[Cursor] プロンプト送信
  ↓
claude-mem に自動記録
  ↓
[Claude Code] /work で実装
  ↓
[Claude Code] /harness-review でレビュー
  ↓
[Cursor] claude-mem MCP で記録を検索
```

### メモリ管理

- **claude-mem**: すべてのセッション記録を自動保存
- **SSOT (.claude/memory/)**: 重要な決定事項を手動でキュレーション
- **統合**: `/sync-ssot-from-memory` で claude-mem から SSOT へ昇格

## 再現性の保証

このコマンドは以下の方法で再現性を保証します:

### 冪等性（Idempotency）

同じコマンドを複数回実行しても安全:

```bash
# 初回実行
/cursor-mem --local
# → ファイルを生成

# 2回目実行
/cursor-mem --local
# → 既存ファイルをスキップ（--force で上書き可能）
```

### 検証メカニズム

セットアップの正確性を保証:

| スクリプト | 検証内容 | 実行タイミング |
|----------|---------|---------------|
| `scripts/setup-cursor-mem.sh` | セットアップ実行 + 簡易テスト | セットアップ時 |
| `scripts/validate-cursor-mem.sh` | 全項目の包括的検証 | セットアップ後 |
| `tests/cursor-mem/verify-records.sh` | 記録の実際の動作確認 | 動作確認時 |

### バージョン管理

設定ファイルはバージョン管理下にありますが、ユーザー固有のファイルは除外:

| ファイル | Git 管理 | 理由 |
|---------|---------|------|
| `.cursor/rules/claude-mem.md.template` | ✅ Yes | ルールテンプレート |
| `.cursor/rules/claude-mem.md` | ❌ No | ユーザー固有（テンプレートからコピー） |
| `.cursor/hooks.json.example` | ✅ Yes | フックテンプレート |
| `.cursor/hooks.json` | ❌ No | ユーザー固有 |
| `scripts/cursor-hooks/*.js` | ✅ Yes | 共有ロジック |
| `.cursor/mcp.json` | ❌ No | ユーザー固有 |
| `~/.cursor/mcp.json` | ❌ No | グローバル設定 |

### 依存関係の明確化

必須条件:

1. **Worker**: `claude-mem` がインストール済み（`claude-mem --version`）
2. **データベース**: `~/.claude-mem/claude-mem.db` が存在
3. **Node.js**: v18.0.0 以上（フックスクリプト実行用）
4. **Bash**: v4.0 以上（セットアップスクリプト実行用）

これらは `./scripts/validate-cursor-mem.sh` で自動チェックされます。

## 関連ドキュメント

- [統合ガイド](../../docs/guides/cursor-mem-integration.md) - 詳細なセットアップ手順
- [テスト計画](../../tests/cursor-mem/test-plan.md) - テストケースと検証方法
- [cursor-mem スキル](../../skills/cursor-mem/SKILL.md) - MCP ツールの使い方

## ハーネスコマンド

関連するハーネスコマンド:

- `/validate` - プロジェクト全体の検証（cursor-mem 設定を含む）
- `/sync-status` - 現在の状態確認
- `/sync-ssot-from-memory` - claude-mem から SSOT へデータ移行
- `/harness-mem` - Claude Code × claude-mem 統合（別コマンド）

## サポート

問題が解決しない場合:

1. [Claude Code Issues](https://github.com/anthropics/claude-code/issues)
2. [Claude-mem Issues](https://github.com/thedotmack/claude-mem/issues)
3. [Claude-code-harness Issues](https://github.com/your-repo/claude-code-harness/issues)
