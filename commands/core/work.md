---
description: Plans.mdのタスクを実行（Solo/2-Agent両対応、並列実行を積極活用）
description-en: Execute Plans.md tasks (Solo/2-Agent, parallel execution enabled)
---

# /work - 計画の実行

Plans.md の計画を実行し、実際のコードを生成します。
**並列実行を積極的に活用**し、効率的にタスクを完了します。

## バイブコーダー向け（こう言えばOK）

- 「**Plans.md のタスクを進めて**」→ このコマンド
- 「**まず動くところまで作って**」→ 最小の動作確認までを先に通します
- 「**全部まとめてやって**」→ 並列実行で一気に処理します
- 「**途中から再開したい**」→ 進行中（cc:WIP）や依頼中（pm:依頼中）を拾って再開
- 「**フルサイクルで**」→ `--full` モード（実装→レビュー→commit）

## できること（成果物）

- Plans.md のタスクを**並列実行で効率的に**実装
- 途中で詰まったら原因切り分け→修正→再検証まで回す
- **2-Agent の場合**: pm:依頼中 のタスクを優先的に処理
- **--full モード**: 実装→セルフレビュー→クロスレビュー→commit の完全自動化

---

## 🚀 --full モード（フルサイクル自動化）

`/work --full` で「実装→セルフレビュー→改善→commit」を自動で回します。

### オプション一覧

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--full` | フルサイクル実行 | false |
| `--parallel N` | 並列数指定 | 1 |
| `--isolation` | lock / worktree | lock |
| `--commit-strategy` | task / phase / all | task |
| `--deploy` | commit 後に deploy | false |
| `--max-iterations` | 改善ループ上限 | 3 |
| `--skip-cross-review` | Phase 2 スキップ | false |

### --isolation オプション

| 値 | 動作 | 推奨 |
|-----|------|------|
| `lock` | 同一worktree + ファイルロック | 小〜中規模タスク |
| `worktree` | git worktree分離 + pnpmで容量節約 | 大規模タスク、真の並列ビルド |

### --full モードのフロー

```
/work --full --parallel 3
    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 1: 並列実装 + セルフレビュー                       │
├─────────────────────────────────────────────────────────┤
│  [task-worker A] 実装→セルフレビュー→修正（最大3回）    │
│  [task-worker B] 実装→セルフレビュー→修正              │
│  [task-worker C] 実装→セルフレビュー→修正              │
│                                                         │
│  各ワーカーが commit_ready を返すまで自律的にループ     │
└─────────────────────────────────────────────────────────┘
    ↓ 全員「commit_ready」を待つ
┌─────────────────────────────────────────────────────────┐
│ Phase 2: クロスレビュー（Codex 8並列）                  │
├─────────────────────────────────────────────────────────┤
│  Codex 8並列エキスパートレビュー                        │
│  ※セルフレビューでは見落とす問題を検出                 │
│  ※追加指摘あり → 該当タスクを Phase 1 へ戻す           │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: 統合 Commit                                    │
├─────────────────────────────────────────────────────────┤
│  ├── コンフリクト検出・解消                             │
│  ├── 最終ビルド検証                                     │
│  └── Conventional Commit で commit                      │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 4: Deploy（--deploy 指定時のみ）                  │
└─────────────────────────────────────────────────────────┘
```

### --commit-strategy の動作

| 値 | 動作 |
|-----|------|
| `task` | 各タスク完了時に個別 commit |
| `phase` | フェーズ完了時にまとめて commit |
| `all` | 全タスク + クロスレビュー完了後に 1 commit |

### エスカレーション

task-worker が 3回修正しても問題が解決しない場合、親に集約してユーザーに一括確認します。

```
⚠️ エスカレーション（2件）

タスクA: 型 'unknown' を 'User' に変換できません
  → 提案: User 型の定義を確認するか、型ガードを追加

タスクB: テスト 'should validate email' が失敗
  → 提案: 正規表現パターンを修正

どう対応しますか？
1. 提案を適用して続行
2. スキップして次へ
3. 手動で修正する
```

---

## 📐 --full モード詳細実装

### Phase 1: 依存グラフ構築と並列起動

**依存グラフ構築ロジック**:

```
Plans.md のタスクを解析:
    ↓
1. タスクごとに対象ファイルを抽出
    ↓
2. ファイル依存関係を判定
   ├── 同一ファイル編集 → 直列
   ├── import 依存あり → 直列
   └── 独立 → 並列可能
    ↓
3. 依存グラフを構築
    ↓
4. 並列実行グループを決定
```

**判定ルール**:

| 条件 | 判定 | 処理 |
|------|------|------|
| 同一ファイルを複数タスクが編集 | 競合 | 直列実行 |
| タスクAの出力がタスクBの入力 | 依存 | A→B 順序で実行 |
| 互いに独立 | 並列可能 | 同一グループ |

**task-worker 起動**:

```
並列グループごとに:
    ↓
Task tool で task-worker を起動:
  - subagent_type: "task-worker"
  - run_in_background: true
  - prompt: {
      task: "タスク説明",
      files: ["対象ファイル"],
      max_iterations: 3,
      review_depth: "standard"
    }
    ↓
起動したタスクIDを収集
```

**結果収集**:

```
全 task-worker の完了を待機:
    ↓
TaskOutput で結果を収集:
  - status: commit_ready | needs_escalation | failed
  - changes: [{file, action}]
  - self_review: {quality, security, performance, compatibility}
    ↓
needs_escalation があれば集約 → ユーザーに一括確認
```

**進捗表示**:

```
📊 Phase 1 進捗: 2/5 完了

├── [worker-1] Header.tsx ✅ commit_ready (35秒)
├── [worker-2] Footer.tsx ✅ commit_ready (28秒)
├── [worker-3] Sidebar.tsx ⏳ セルフレビュー中...
├── [worker-4] Utils.ts ⏳ 実装中...
└── [worker-5] Types.ts 🔜 待機中（依存: Utils.ts）
```

### Phase 2: クロスレビュー実行

**前提条件**:
- Phase 1 の全タスクが `commit_ready` を返した
- `--skip-cross-review` が指定されていない

**実行フロー**:

```
Phase 1 完了判定:
    ↓
Codex 8並列レビューを起動:
  - /harness-review --codex-only
  - 8つのエキスパート観点で同時レビュー
    ↓
追加指摘の抽出:
  - Critical/Major の問題があれば該当タスクを Phase 1 へ戻す
  - Minor は記録のみ（commit 可能）
    ↓
問題なし → Phase 3 へ
```

**レビュー観点（8並列）**:

| # | エキスパート | 観点 |
|---|-------------|------|
| 1 | Security | 脆弱性、認証、入力検証 |
| 2 | Performance | N+1、メモリリーク、レンダリング |
| 3 | Maintainability | 可読性、命名、構造 |
| 4 | Compatibility | API互換性、回帰リスク |
| 5 | Accessibility | a11y、キーボード操作 |
| 6 | Type Safety | 型定義、any回避 |
| 7 | Error Handling | エラー処理、フォールバック |
| 8 | Best Practices | フレームワーク規約、パターン |

### Phase 3: 統合 Commit

**コンフリクト検出・解消**:

```
--isolation=lock の場合:
  - git diff でファイル変更を確認
  - 同一行への競合があれば警告 → ユーザー確認

--isolation=worktree の場合:
  - 各 worktree のブランチをマージ
  - 3-way merge で自動解消を試行
  - 解消不可なら手動介入を依頼
```

**最終ビルド検証**:

```
pnpm build（または npm run build）
    ↓
成功 → commit へ
失敗 → エラー分析 → 自動修正試行（最大3回）
```

**Conventional Commit 生成**:

```
変更内容を分析:
    ↓
適切なプレフィックスを選択:
  - feat: 新機能
  - fix: バグ修正
  - refactor: リファクタリング
  - docs: ドキュメント
    ↓
commit メッセージ生成:
  feat(components): add Header, Footer, Sidebar components

  - Add responsive Header with navigation
  - Add Footer with copyright and links
  - Add collapsible Sidebar for mobile

  Co-Authored-By: Claude <noreply@anthropic.com>
```

**戦略別の commit 実行**:

| 戦略 | 動作 | 適切なケース |
|------|------|-------------|
| `task` | タスクごとに個別 commit | 変更履歴を細かく残したい |
| `phase` | フェーズごとにまとめて commit | 論理的な単位でまとめたい |
| `all` | 全完了後に 1 commit | 機能単位で 1 commit にしたい |

### Phase 4: Deploy（オプション）

**前提条件**:
- `--deploy` フラグが指定されている
- Phase 3 の commit が成功している

**安全ゲート**:

```
Deploy 前チェック:
    ↓
1. 本番環境の検出
   ├── Vercel: VERCEL_ENV=production
   ├── Netlify: CONTEXT=production
   └── カスタム: DEPLOY_ENV=production
    ↓
2. 安全確認プロンプト
   ⚠️ 本番環境へのデプロイを実行しますか？
   - ブランチ: main
   - 変更ファイル: 5件
   - 最終テスト: ✅ 通過

   [y/N]
    ↓
3. デプロイ実行
   └── deploy スキルを呼び出し
```

**デプロイ実行**:

```
Skill tool で deploy スキルを起動:
  - skill: "claude-code-harness:deploy"
    ↓
デプロイコマンド実行:
  ├── Vercel: vercel --prod
  ├── Netlify: netlify deploy --prod
  └── カスタム: npm run deploy
    ↓
結果確認:
  - デプロイURL
  - ビルド時間
  - ステータス
```

**結果レポート**:

```
🚀 Deploy 完了

| 項目 | 値 |
|------|-----|
| 環境 | production |
| URL | https://my-app.vercel.app |
| ビルド時間 | 45秒 |
| ステータス | ✅ 成功 |

変更内容:
- feat(components): add Header, Footer, Sidebar
- 5 files changed, 320 insertions(+)
```

---

## ⚡ 並列実行ファースト

このコマンドは**並列実行を積極的に活用**します。

### 基本方針

```
独立タスクが2つ以上 → 並列実行（デフォルト）
依存関係あり → 直列実行
```

### 並列実行の判断基準

| 条件 | 判断 | 例 |
|------|------|-----|
| 別ファイルを編集 | ✅ 並列 | Header.tsx と Footer.tsx |
| 同じファイルを編集 | ⚠️ 直列 | 同じ index.tsx に追記 |
| A の出力が B の入力 | ⚠️ 直列 | API作成 → それを使うページ |
| 独立したチェック | ✅ 並列 | lint, test, type-check |

### 実行イメージ

```
📋 Plans.md から 5 タスクを検出

依存関係分析:
├── [独立] Header 作成
├── [独立] Footer 作成
├── [独立] Sidebar 作成
├── [依存] Layout 作成 ← Header, Footer, Sidebar に依存
└── [依存] Page 作成 ← Layout に依存

実行計画:
🚀 並列グループ1: Header, Footer, Sidebar (同時実行)
   ↓
🔧 直列: Layout 作成
   ↓
🔧 直列: Page 作成

推定時間: 直列 5分 → 並列活用 2分30秒 (50%短縮)
```

---

## 自動判断ロジック

Plans.md のマーカーを確認し、適切なモードで動作：

| 検出マーカー | 動作モード |
|-------------|-----------|
| `pm:依頼中` / `cursor:依頼中` あり | 2-Agent（PM からの依頼を優先処理） |
| `cc:TODO` / `cc:WIP` のみ | Solo（自律実行） |

**優先度**: `pm:依頼中` > `cc:WIP`（継続） > `cc:TODO`（新規）

### タスク着手時のマーカー自動更新

`/work` は着手時に自動的に **`cc:WIP`** へ遷移します：

```
pm:依頼中 / cursor:依頼中 / cc:TODO → cc:WIP（着手時に自動更新）
```

これにより、従来の `/start-task` 相当の「タスク開始→マーカー更新」が `/work` に統合されています。

---

## 🔧 自動呼び出しスキル（必須）

**このコマンドは以下のスキルを Skill ツールで明示的に呼び出すこと**：

| スキル | 用途 | 呼び出しタイミング |
|-------|------|------------------|
| `impl` | 機能実装（親スキル） | タスク実装時 |
| `verify` | ビルド検証・エラー復旧（親スキル） | 実装後の検証時 |

**呼び出し方法**:
```
Skill ツールを使用:
  skill: "claude-code-harness:impl"      # 機能実装
  skill: "claude-code-harness:verify"    # ビルド検証
```

**子スキル（自動ルーティング）**:
- `work-impl-feature` - 機能実装
- `work-write-tests` - テスト作成
- `verify-build` - ビルド検証
- `error-recovery` - エラー復旧

> ⚠️ **重要**: スキルを呼び出さずに進めると usage 統計に記録されません。必ず Skill ツールで呼び出してください。

---

## 🔧 LSP 機能の活用

実装作業では LSP（Language Server Protocol）を積極的に活用します。

### 実装前: コード理解

| LSP 機能 | 活用場面 | 効果 |
|---------|---------|------|
| **Go-to-definition** | 既存関数の中身を確認 | 実装パターンを素早く把握 |
| **Find-references** | 影響範囲の事前調査 | 意図しない破壊的変更を防止 |
| **Hover** | 型情報・ドキュメント確認 | 正しいインターフェースで実装 |

### 実装中: リアルタイム検証

| LSP 機能 | 活用場面 | 効果 |
|---------|---------|------|
| **Diagnostics** | 型エラー・構文エラーの即座検出 | ビルド前に問題を発見 |
| **Completions** | 正しい API の使用 | タイポ・間違った引数を防止 |

### 実装後: 品質確認

```
実装完了後に LSP Diagnostics を実行:
→ 型エラーがないことを確認
→ 未使用変数・import を検出
→ 潜在的な問題を早期発見
```

### VibeCoder 向けの言い方

| やりたいこと | 言い方 |
|-------------|--------|
| 関数の中身を知りたい | 「この関数の定義を見せて」 |
| どこで使われてるか調べたい | 「この変数の参照箇所を探して」 |
| エラーをチェックしたい | 「LSP診断を実行して」 |

詳細: [docs/LSP_INTEGRATION.md](../../docs/LSP_INTEGRATION.md)

---

## 実行フロー

### Step 1: Plans.md の確認と並列化分析

```bash
cat Plans.md
```

現在の `cc:TODO` タスクを抽出し、**並列実行可能かを分析**。

### Step 2: 実行計画の提示

> 🔧 **実行計画**
>
> **並列実行グループ**:
> | タスク | 対象ファイル | 推定時間 |
> |-------|-------------|---------|
> | Header作成 | src/components/Header.tsx | ~30秒 |
> | Footer作成 | src/components/Footer.tsx | ~30秒 |
> | Sidebar作成 | src/components/Sidebar.tsx | ~30秒 |
>
> **直列実行（依存あり）**:
> | タスク | 依存先 | 推定時間 |
> |-------|--------|---------|
> | Layout作成 | Header, Footer, Sidebar | ~45秒 |
>
> **合計推定時間**: 直列 2分15秒 → 並列活用 1分15秒
>
> 実行しますか？

### Step 3: Task ツールで並列実行

Claude Code の Task ツールを使用して**バックグラウンドで並列実行**。

```
🚀 並列実行開始...

├── [Agent 1] Header作成中... ⏳
├── [Agent 2] Footer作成中... ⏳
└── [Agent 3] Sidebar作成中... ⏳
```

**重要**:
- Task ツールは `run_in_background: true` で起動
- `TaskOutput` で結果を収集
- 最大10タスクまで同時実行可能

### Step 4: 結果の収集と統合レポート

```
📊 並列実行完了

├── [Agent 1] Header作成 ✅ (25秒)
│   └── src/components/Header.tsx 作成
├── [Agent 2] Footer作成 ✅ (28秒)
│   └── src/components/Footer.tsx 作成
└── [Agent 3] Sidebar作成 ✅ (22秒)
    └── src/components/Sidebar.tsx 作成

⏱️ 所要時間: 28秒（直列なら75秒、63%短縮）
```

### Step 5: 直列タスクの実行

依存関係のあるタスクを順番に実行。

### Step 6: Plans.md の更新と完了報告

```markdown
# Plans.md 更新
- [x] Header 作成 `cc:完了`
- [x] Footer 作成 `cc:完了`
- [x] Sidebar 作成 `cc:完了`
- [x] Layout 作成 `cc:完了`
```

---

## 統合レポート形式

```markdown
## 📊 タスク実行レポート

**実行日時**: 2025-12-15 10:30:00
**タスク数**: 5件（並列3 + 直列2）
**所要時間**: 1分15秒（直列なら2分15秒、44%短縮）

### 実行結果

| # | タスク | 実行方式 | ステータス | 所要時間 |
|---|-------|---------|----------|---------|
| 1 | Header作成 | 並列 | ✅ 成功 | 25秒 |
| 2 | Footer作成 | 並列 | ✅ 成功 | 28秒 |
| 3 | Sidebar作成 | 並列 | ✅ 成功 | 22秒 |
| 4 | Layout作成 | 直列 | ✅ 成功 | 45秒 |
| 5 | Page作成 | 直列 | ✅ 成功 | 30秒 |

### 変更ファイル一覧

- `src/components/Header.tsx` (新規)
- `src/components/Footer.tsx` (新規)
- `src/components/Sidebar.tsx` (新規)
- `src/components/Layout.tsx` (新規)
- `src/app/page.tsx` (更新)

### 次のアクション

- [ ] 動作確認 (`npm run dev`)
- [ ] テスト実行 (`npm test`)
- [ ] コードレビュー
```

---

## エラーハンドリング

### 並列実行で一部失敗時

```
📊 並列実行完了（一部エラー）

├── [Agent 1] Header作成 ✅ (25秒)
├── [Agent 2] Footer作成 ❌ エラー
│   └── 原因: Import パスが見つからない
└── [Agent 3] Sidebar作成 ✅ (22秒)

⚠️ 1件のタスクが失敗しました。

対応オプション:
1. 失敗タスクのみ再実行
2. エラー内容を確認して手動修正
3. 全体をロールバック
```

**対応**:
1. 成功したタスクの結果は保持
2. 失敗タスクのエラー詳細を表示
3. `error-recovery` スキルで自動修正を試行（最大3回）

### 全タスク失敗時

```
❌ 並列実行失敗

全てのタスクでエラーが発生しました。
共通の原因がある可能性があります。

エラー分析:
- 全タスクで `@/lib/supabase` の import エラー
- 原因: supabase.ts が未作成

推奨アクション:
1. 先に依存ファイルを作成
2. 実行順序を見直し
```

---

## 実行パターン集

### パターン1: 複数コンポーネント（並列）

```
入力: Header, Footer, Sidebar を作成

→ 3タスクとも独立 → 並列実行
→ Task ツールで3エージェント起動
→ 結果を統合レポートにまとめ
```

### パターン2: 品質チェック（並列）

```
入力: lint, test, type-check を実行

→ 全て独立 → 並列実行
→ 結果:
  ├── [Lint] ✅ 警告: 2件
  ├── [Test] ✅ 15/15 通過
  └── [Type] ✅ エラーなし
```

### パターン3: 依存チェーン（混合）

```
入力: API → ページ → テスト を作成

→ 依存関係あり → 直列実行
→ ただしテストは API テスト、ページテストを並列化可能
```

---

## VibeCoder 向けヒント

| 言いたいこと | 言い方 |
|-------------|--------|
| 全部並列でやって | 「まとめてやって」「一気に片付けて」 |
| 進捗を知りたい | 「今どこまで進んだ？」 |
| 動作確認したい | 「動かしてみて」 |
| 次に進みたい | 「次のタスク」 |
| 一つずつやって | 「順番に一つずつ」 |

---

## 注意事項

- **同一ファイルへの同時書き込みは自動回避**されます
- **10タスク超**の場合はバッチ分割して実行
- 長時間タスクは `Ctrl+B` でバックグラウンド化可能
