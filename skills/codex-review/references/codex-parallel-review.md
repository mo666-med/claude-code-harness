# Codex 並列レビュー実行ガイド

Codex モード時に複数のエキスパートを並列で呼び出すためのオーケストレーション手順。

## 概要

Codex モードでは、Claude がオーケストレーターとして 8 つのエキスパートを MCP 経由で並列呼び出しします。

```
Claude (オーケストレーター)
    ↓
並列 MCP 呼び出し
    ├── Security Expert
    ├── Accessibility Expert
    ├── Performance Expert
    ├── Quality Expert
    ├── SEO Expert
    ├── Architect Expert
    ├── Plan Reviewer Expert
    └── Scope Analyst Expert
    ↓
結果統合 → コミット判定
```

## 実行フロー

### Step 1: 設定確認

```yaml
# .claude-code-harness.config.yaml から読み込み
review:
  mode: codex
  codex:
    enabled: true
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

### Step 2: 変更ファイルの収集

```bash
# git diff で変更ファイルを取得
git diff --name-only HEAD~1
```

### Step 3: エキスパートプロンプトの準備

各エキスパートに送信するプロンプトを `experts/*.md` から読み込み、以下を置換:
- `{files}`: 変更ファイルリスト
- `{tech_stack}`: 検出された技術スタック
- `{plan_content}`: Plans.md の内容（Plan Reviewer 用）
- `{requirements}`: 要件内容（Scope Analyst 用）

### Step 4: 並列 MCP 呼び出し

**重要**: 設定で `enabled: true` のエキスパートのみ呼び出し

```typescript
// 並列呼び出しの概念コード
const enabledExperts = Object.entries(config.review.codex.experts)
  .filter(([_, enabled]) => enabled)
  .map(([name]) => name);

// 並列実行
const results = await Promise.all(
  enabledExperts.map(expert =>
    mcp__codex__codex({
      prompt: getPromptForExpert(expert, files, techStack),
      sandbox: "read-only"
    })
  )
);
```

### Step 5: 結果統合

各エキスパートからの結果を統合:

```markdown
## 📊 Codex 並列レビュー結果

### エキスパート別サマリー

| Expert | Score | Critical | High | Medium | Low |
|--------|-------|----------|------|--------|-----|
| Security | B | 0 | 1 | 2 | 3 |
| Accessibility | A | 0 | 0 | 1 | 2 |
| Performance | C | 0 | 2 | 3 | 1 |
| Quality | B | 0 | 0 | 4 | 5 |
| SEO | A | 0 | 0 | 0 | 2 |
| Architect | B | 0 | 1 | 1 | 0 |
| Plan Reviewer | APPROVE | - | - | - | - |
| Scope Analyst | Proceed | - | - | - | - |

### 統合 Findings

| # | Expert | Severity | File | Issue |
|---|--------|----------|------|-------|
| 1 | Security | High | src/api/auth.ts:45 | SQL Injection |
| 2 | Performance | High | src/api/posts.ts:23 | N+1 Query |
| 3 | Architect | High | src/services/ | Circular dependency |
```

### Step 6: コミット判定

統合結果から最終判定を算出:

| 集計 | 判定 |
|------|------|
| Critical ≥ 1 | REJECT |
| High ≥ 1 または Medium > 3 | REQUEST CHANGES |
| それ以外 | APPROVE |

## エラーハンドリング

### 一部エキスパート失敗時

```markdown
⚠️ 一部のエキスパートでエラーが発生しました

| Expert | Status |
|--------|--------|
| Security | ✅ 成功 |
| Performance | ❌ タイムアウト |
| Quality | ✅ 成功 |

失敗したエキスパートをスキップして判定を続行しますか？
```

### 全エキスパート失敗時

```markdown
❌ Codex エキスパートとの通信に失敗しました

原因: MCP サーバー接続エラー

フォールバック: Claude 単体でレビューを実行しますか？
```

## 自動修正ループ

REQUEST CHANGES 判定時の自動修正フロー:

```
REQUEST CHANGES 判定
    ↓
修正対象の抽出（High/Medium の Findings）
    ↓
Claude が修正実行
    ↓
再度 Codex 並列レビュー
    │
    ├── APPROVE → 完了
    ├── REQUEST CHANGES → ループ（リトライ: ${current}/${max_retries}）
    └── REJECT → 手動対応必要
```

### リトライ制限

- デフォルト: 最大 3 回
- 設定: `review.judgment.max_retries`

### リトライ超過時

```markdown
## ⚠️ 自動修正上限に到達

${max_retries} 回の自動修正を試みましたが、以下の問題が残っています:

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | High | src/api/users.ts | N+1 Query |

**推奨アクション**:
1. 手動で上記を修正
2. 再度 `/harness-review` を実行
```

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `experts/security-expert.md` | セキュリティエキスパートプロンプト |
| `experts/accessibility-expert.md` | a11y エキスパートプロンプト |
| `experts/performance-expert.md` | パフォーマンスエキスパートプロンプト |
| `experts/quality-expert.md` | 品質エキスパートプロンプト |
| `experts/seo-expert.md` | SEO エキスパートプロンプト |
| `experts/architect-expert.md` | 設計エキスパートプロンプト |
| `experts/plan-reviewer-expert.md` | 計画レビューエキスパートプロンプト |
| `experts/scope-analyst-expert.md` | 要件分析エキスパートプロンプト |
| `commit-judgment-logic.md` | コミット判定ロジック |
