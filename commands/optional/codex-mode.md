---
description: ""
description-en: ""
---

# /codex-mode - Codex モード切り替え

レビュー時の Codex モード（GPT エキスパートへの並列委譲）を切り替えます。

## 使用方法

```bash
/codex-mode           # 現在の状態を表示
/codex-mode on        # Codex モードを有効化
/codex-mode off       # Codex モードを無効化
/codex-mode status    # 詳細設定を表示
```

## 前提条件

- Codex MCP サーバーが設定済みであること
- `/codex-review` または `/harness-review` でセットアップ済み

## Codex モードとは

| モード | レビュー実行者 | 特徴 |
|-------|--------------|------|
| **デフォルト** | Claude 単体 | 高速、Codex 不要 |
| **Codex モード** | Codex（GPT） | 9 エキスパートに並列委譲 |

### Codex モードの 9 エキスパート

| エキスパート | 役割 | 観点 |
|-------------|------|------|
| Security | セキュリティ分析 | OWASP Top 10、認証・認可 |
| Accessibility | a11y チェック | WCAG 2.1 AA 準拠 |
| Performance | パフォーマンス分析 | レンダリング、DB クエリ |
| Quality | コード品質 | 可読性、保守性 |
| SEO | SEO/OGP チェック | メタタグ、構造化データ |
| Architect | 設計レビュー | アーキテクチャ判断 |
| Plan Reviewer | 計画検証 | 完全性、リスク分析 |
| Scope Analyst | 要件分析 | 曖昧さ、欠落の検出 |

## 実行フロー

### 1. 状態表示 (`/codex-mode`)

```markdown
## Codex モード設定

現在: **OFF** (デフォルトモード)

レビュー実行者: Claude 単体
Codex MCP: ✅ 設定済み

切り替え: `/codex-mode on` で有効化
```

### 2. 有効化 (`/codex-mode on`)

```markdown
## Codex モード: ON

✅ Codex モードを有効化しました

有効なエキスパート:
- ✅ Security
- ✅ Accessibility
- ✅ Performance
- ✅ Quality
- ✅ SEO
- ✅ Architect
- ✅ Plan Reviewer
- ✅ Scope Analyst

次回の `/harness-review` から Codex に並列委譲されます。
```

### 3. 無効化 (`/codex-mode off`)

```markdown
## Codex モード: OFF

✅ デフォルトモードに戻しました

次回の `/harness-review` は Claude 単体で実行されます。
```

### 4. 詳細表示 (`/codex-mode status`)

```markdown
## Codex モード詳細設定

| 設定項目 | 現在値 |
|---------|--------|
| モード | codex |
| 判定出力 | enabled |
| 自動修正 | enabled |
| 最大リトライ | 3 |

### エキスパート設定

| エキスパート | 状態 |
|-------------|------|
| security | ✅ ON |
| accessibility | ✅ ON |
| performance | ✅ ON |
| quality | ✅ ON |
| seo | ✅ ON |
| architect | ✅ ON |
| plan_reviewer | ✅ ON |
| scope_analyst | ✅ ON |

### 個別切り替え

```bash
/codex-mode experts security off   # Security のみ無効化
/codex-mode experts architect on   # Architect のみ有効化
```
```

## 設定ファイルの更新

このコマンドは `.claude-code-harness.config.yaml` を更新します。

```yaml
review:
  mode: codex  # default | codex
  judgment:
    enabled: true
    auto_fix: true
    max_retries: 3
  codex:
    enabled: true
    auto: true
    experts:
      security: true
      accessibility: true
      performance: true
      quality: true
      seo: true
      architect: true
      plan_reviewer: true
      scope_analyst: true
```

## エキスパート個別設定

特定のエキスパートだけを有効/無効にできます。

```bash
# Security のみ無効化（他は維持）
/codex-mode experts security off

# Architect と Plan Reviewer のみ有効化
/codex-mode experts architect on
/codex-mode experts plan_reviewer on
```

## VibeCoder 向け

| やりたいこと | 言い方 |
|-------------|--------|
| Codex を使いたい | 「Codex モードにして」 |
| 通常に戻したい | 「デフォルトに戻して」 |
| 設定を確認したい | 「Codex の設定を見せて」 |
| セキュリティだけ無効 | 「セキュリティチェックはいらない」 |

## 関連コマンド

- `/harness-review` - レビュー実行（Codex モード対応）
- `/codex-review` - Codex MCP セットアップ
