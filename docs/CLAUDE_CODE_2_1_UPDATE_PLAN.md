# Claude Code 2.1.0 対応アップデートプラン

## 🎯 概要

Claude Code v2.1.0 で導入された新機能に harness を対応させるためのアップデートプランです。

---

## 📋 変更一覧

### Phase 1: スキル・エージェントのフロントマター拡張（高優先度）

#### 1.1 新しいフロントマターフィールドの対応

| フィールド | 対象 | 説明 | 用途 |
|-----------|------|------|------|
| `context: fork` | skill/command | 分離コンテキストで実行 | 重い処理の分離、コンテキスト汚染防止 |
| `agent` | skill | エージェントタイプを指定 | スキル実行時のモデル・設定指定 |
| `skills` | agent | サブエージェント用スキル自動読み込み | エージェントに必要なスキルを宣言 |
| `user-invocable: false` | skill | スラッシュメニューから非表示 | 内部スキルの非公開化 |
| `permissionMode` | agent | エージェントの権限モード | 安全性制御 |
| `disallowedTools` | agent | 禁止ツールリスト | 明示的なツールブロック |

- [ ] cc:TODO `/harness-init`で生成するテンプレートに新フィールドを追加
- [ ] cc:TODO 既存エージェント（6個）に `skills` フィールド追加を検討
- [ ] cc:TODO 既存エージェントに `disallowedTools` フィールド追加（安全性強化）
- [ ] cc:TODO 内部専用スキルに `user-invocable: false` を設定

#### 1.2 エージェントへのインラインフック対応

Claude Code 2.1.0 では、エージェントのフロントマターに直接フックを定義可能になりました。

```yaml
---
name: my-agent
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "echo 'checking...'"
  PostToolUse:
    - matcher: "*"
      command: "echo 'done'"
  Stop:
    - prompt: "Summarize what was done"
---
```

- [ ] cc:TODO エージェントテンプレートにインラインフック例を追加
- [ ] cc:TODO `ci-cd-fixer`エージェントにPreToolUseフック追加（危険コマンド検出）

---

### Phase 2: フックシステムの拡張（高優先度）

#### 2.1 新しいフック設定オプション

| オプション | 説明 | ユースケース |
|-----------|------|-------------|
| `once: true` | フックを1回だけ実行 | セッション初期化、1回限りの通知 |
| `SubagentStart` | サブエージェント開始時 | サブエージェント監視、ログ記録 |
| `SubagentStop` | サブエージェント終了時 | 結果収集、エスカレーション判定 |

- [ ] cc:TODO `hooks/hooks.json` に `SubagentStart` フック追加
- [ ] cc:TODO `SubagentStop` フック追加（agent_id, agent_transcript_path活用）
- [ ] cc:TODO `session-init.sh` フックに `once: true` を適用（重複実行防止）
- [ ] cc:TODO フック用スクリプト `subagent-tracker.sh` 作成

#### 2.2 hooks.json の更新

```json
{
  "SubagentStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/run-script.js\" subagent-tracker start",
          "timeout": 5
        }
      ]
    }
  ],
  "SubagentStop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/run-script.js\" subagent-tracker stop",
          "timeout": 5
        }
      ]
    }
  ]
}
```

---

### Phase 3: 設定テンプレートの更新（中優先度）

#### 3.1 language設定の追加

Claude Code 2.1.0 では `language` 設定で応答言語を指定可能になりました。

- [ ] cc:TODO `templates/claude/settings.local.json.template` に `language` 設定追加
- [ ] cc:TODO `/harness-init` で言語設定を自動検出（ja/en）

#### 3.2 ワイルドカード権限パターンの活用

Bash権限で `*` ワイルドカードが使用可能になりました。

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(git * main)",
      "Bash(bun *)"
    ]
  }
}
```

- [ ] cc:TODO 権限テンプレートにワイルドカードパターン例を追加
- [ ] cc:TODO `templates/claude/settings.security.json.template` 更新

#### 3.3 MCP動的更新対応

MCP `list_changed` 通知により、サーバーが動的にツールを更新可能になりました。

- [ ] cc:TODO `harness-ui` MCP サーバーで動的ツール更新を検討

---

### Phase 4: ドキュメント更新（中優先度）

#### 4.1 新機能ドキュメント

- [ ] cc:TODO `docs/CLAUDE_CODE_2_1_FEATURES.md` 作成（新機能解説）
- [ ] cc:TODO `docs/ARCHITECTURE.md` 更新（新フック、新フィールド）
- [ ] cc:TODO `README.md` 更新（Claude Code 2.1.0対応を明記）

#### 4.2 CHANGELOG更新

- [ ] cc:TODO `CHANGELOG.md` に v2.7.0 エントリ追加

---

### Phase 5: 既存機能の最適化（低優先度）

#### 5.1 Exploreサブエージェント活用

Claude Code 2.0.17 で導入された `Explore` サブエージェントは Haiku でコードベースを効率的に検索します。

- [ ] cc:TODO `/sync-status` コマンドで Explore エージェント活用を検討
- [ ] cc:TODO プロジェクト分析スキルで Explore 活用

#### 5.2 context: fork の活用

- [ ] cc:TODO 重い処理を行うスキル（例：code-reviewer呼び出し）に `context: fork` を適用
- [ ] cc:TODO `/harness-review` コマンドを fork コンテキストで実行

---

## 🔄 互換性確認

### 非推奨となった機能

| 機能 | 状態 | harness対応 |
|------|------|------------|
| `claude config` コマンド | 非推奨 | ✅ すでに settings.json 使用 |
| 出力スタイル | 非推奨→再有効化 | ⚠️ 検討 |
| `ignorePatterns` in .claude.json | 移行済み | ✅ settings.json へ |

### 新しいフック入力フィールド

| フィールド | 追加バージョン | 対応状況 |
|-----------|---------------|---------|
| `tool_use_id` | 2.0.43 | ⚠️ 未使用 |
| `agent_id` (SubagentStop) | 2.0.42 | ⚠️ 未対応 |
| `agent_transcript_path` (SubagentStop) | 2.0.42 | ⚠️ 未対応 |
| `hook_event_name` | 2.0.41 | ⚠️ 未使用 |

---

## 📊 優先度サマリー

| Phase | 優先度 | タスク数 | 工数目安 |
|-------|--------|---------|---------|
| Phase 1 | 高 | 6 | 中 |
| Phase 2 | 高 | 5 | 中 |
| Phase 3 | 中 | 4 | 小 |
| Phase 4 | 中 | 4 | 小 |
| Phase 5 | 低 | 4 | 小 |

---

## 🚀 次のステップ

1. **Phase 1 + Phase 2 を同時着手**（高優先度）
2. フロントマター拡張のための既存ファイル調査
3. hooks.json の拡張実装
4. テスト追加

---

## 📝 参考リンク

- [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
