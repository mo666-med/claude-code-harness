# Plans.md - harness-ui 開発計画

## 概要
- **目的**: Agent機能をハーネス思想（Plan→Work→Review）に沿って強化
- **対象**: harness-ui フロントエンド・バックエンド

---

## アーカイブ済み（フェーズ1-6）

> 詳細は Git 履歴参照。全9タスク完了。
> - Security修正、Accessibility修正、Quality改善、Performance最適化、検証、プロジェクト自動登録

---

## ✅ フェーズ7: Agent Console 機能強化 `cc:完了`

### Task 7.1: リアルタイムストリーミング表示 `[feature:ui]` `cc:完了`
- [x] SDK メッセージをリアルタイムで UI に表示（WebSocket 経由で即時反映）
- [x] ターミナルライクな出力表示（tool_use/tool_result を色・ラベル・バッジで視覚的に区別）
- [x] ストリーミング中のインジケーター表示（実行中のみ表示、完了後消える）
- [x] 長い出力の折りたたみ（500文字以上で自動折りたたみ）
- [x] ツール入力の詳細表示（details/summary で展開可能）

### Task 7.2: スラッシュコマンド変換方式の決定 `[feature:ux]` `cc:完了`
- [x] 方式を決定（UI変換 / システムプロンプト / コマンドピッカー）→ **UI側変換（既知コマンドのみ）**
- [x] 選択した方式を実装 → `command-utils.ts` で変換ロジック分離
- [x] テスト検証 → 18件のユニットテスト追加

**実装詳細**:
- `/work` 等の既知コマンドのときだけ変換（未知コマンドはそのまま）
- `/Users/...` 等の絶対パスは変換しない
- `convertSlashCommand(input, knownCommands)` で明示的に照合

---

## 📋 フェーズ8: ハーネス思想の可視化（Agent × Dashboard 統合） `pm:確認済`

> **背景**: 現在のAgent機能は「汎用的なClaude SDKフロントエンド」であり、ハーネス固有の価値（Plan→Work→Reviewサイクル、SSOT、次にやるべき行動の推奨）が Agent 画面に反映されていない。  
> **現状把握**: Dashboard は既に Plans.md を読み取って Kanban/WIP を表示しているが、Agent 画面とは分断されている（最大の課題）。

### 背景 / 目的
- **目的**: Agent 画面上で「今どのフェーズで、次に何をすべきか」を迷わず判断できる状態にする（Plan → Work → Review を常時可視化）
- **狙い**: “新規に作る”ではなく、Dashboard 側で既に動いている情報設計（WIP/Health/Plans）を **再利用して Agent に統合**する

### スコープ（やる）
- Agent 画面に **Plans 状態（Plan/Work/Review/Done）と WIP フォーカス**を統合表示
- タスク選択 → **プロンプトテンプレ（タスク名を含む）を自動挿入**
- 実行完了後にユーザー確認を経て **Plans.md のマーカー更新**（競合検知つき）
- プロンプト入力内容 + Plans 状態から **次に使うべきコマンド/スキルをサジェスト**

### 非スコープ（やらない）
- Agent 画面内でのフル Kanban 操作（ドラッグ&ドロップ、並び替え等）
- ユーザー確認なしの Plans.md 自動書き換え
- Agent 実行中のリアルタイムな Plans.md 同期（まずは明示 refresh）

### PM判断（確定）
- **Task 8.1 のレイアウト**: 上部に「フェーズ + 現在フォーカス」を固定表示。詳細（WIP/Plan/Review/SSOT/Quality）は **右サイドの折りたたみパネルに集約（タブ式）**。
- **フェーズ表示のデザイン**: Plan / Work / Review の **3ステップインジケーター**（件数バッジ + 現在ステップ強調）。
- **推奨の発火タイミング**: **入力中に 300ms デバウンス**で表示（入力が空なら非表示）。送信をブロックしない（クリックで挿入）。

### 受入条件（必ず測定可能に）
- [ ] Agent 画面で Plan/Work/Review の現在フェーズが常時表示され、Plans.md の状態（plan/work/review/done 件数）と一致する
- [ ] Agent 画面で WIP（work）タスクが確認でき、Dashboard に移動せずに把握できる
- [ ] タスククリックで、プロンプト欄に「タスク名を含む実行テンプレ」が自動挿入される（既存のコマンドピッカーと共存）
- [ ] 実行完了後の UI 操作で Plans.md の該当タスクのマーカーを更新できる。更新は **競合検知（409）** を持ち、競合時は「再読み込み/手動対応」を促す（無言上書き禁止）
- [ ] `bun run typecheck` と `bun test` が通る

### 評価（Evals）
- **tasks（シナリオ）**:
  - **Scenario A（表示）**: Plans.md を持つプロジェクトを選択 → Agent 画面で WIP とフェーズが表示される
  - **Scenario B（テンプレ）**: Plan/Work いずれかのタスクをクリック → プロンプトにテンプレが挿入される
  - **Scenario C（更新）**: 実行完了 → UI で「完了」→ Plans.md のマーカー更新 → refresh 後にカラム移動が反映される
  - **Scenario D（競合）**: Plans.md を外部で編集してから更新 → 409 → UI が競合を明示し refresh を促す
- **trials（回数/集計）**:
  - 回数: 3
  - 集計: 成功率（3/3）+ 手順の最短経路（Dashboard を経由しない）
- **graders（採点）**:
  - outcome:
    - `bun run typecheck`
    - `bun test`
  - transcript:
    - Plans.md 更新で「タイトル一致」など曖昧マッチをしない（行番号 + 期待行の一致で更新する）
    - 競合時に無言上書きをしない

### Task 8.1: Plans.md 統合（Agent への埋め込み + 更新導線） `[feature:core]` `pm:確認済` `priority:high`
- [ ] Dashboard の WIP/Plans 表示（`WIPFocus` / Kanban 概要など）を **共通コンポーネント化**し Agent 画面に統合
- [ ] Agent 画面に WIP/Plan/Review の **概要（最小表示）** を追加（詳細はサイドパネルへ）
- [ ] タスク選択 → **プロンプトテンプレ自動挿入**（例:「{task} を `cc:WIP` にして実行。完了後 `cc:完了` に更新」）
- [ ] Plans API の task に **source 情報（ファイルパス/行番号/元行/検出したマーカー）** を付与して返す（更新の前提条件に使う）
- [ ] Plans.md 更新 API を実装し、**行番号 + 期待行一致 + 競合(409)検知**で安全にマーカー更新する（`cc:WIP` → `cc:完了` 等）

**期待動作**:
```
AgentでWIP/Planを確認 → タスク選択 → テンプレ挿入
    ↓
実行完了 → 「完了マークしますか？」確認 → Plans.md 更新（競合なら拒否して再読み込み誘導）
```

### Task 8.2: Plan → Work → Review フェーズ表示（ステップインジケーター） `[feature:ux]` `pm:確認済` `priority:high`
- [ ] Agent 画面ヘッダーに Plan/Work/Review の **3ステップ**を表示（件数バッジつき）
- [ ] Plans 状態から現在フェーズを判定し、推奨アクション（短い1行）を表示する

**フェーズ判定ロジック（MVP）**:
| 状態 | フェーズ | 推奨アクション |
|------|---------|---------------|
| work > 0 | Work | 「作業を続けましょう」 |
| work = 0 かつ plan > 0 | Plan | 「タスクを開始しましょう」 |
| mode=2agent かつ review > 0 | Review | 「レビューを実行しましょう」 |

### Task 8.3: コマンド/スキル推奨（入力補助） `[feature:ux]` `pm:確認済` `priority:high`
- [ ] プロンプト入力中に、入力内容 + フェーズに基づいて **推奨コマンド/スキル**をサジェスト（300msデバウンス）
- [ ] サジェストクリックでプロンプトに挿入（送信はブロックしない）
- [ ] 初期実装は **軽量な文字列マッチ**で良い（重いランキング/埋め込みは後回し）

### Task 8.4: SSOT 参照パネル（decisions / patterns） `[feature:integration]` `pm:確認済` `priority:medium`
- [ ] Task 8.1 のサイドパネルに SSOT タブを追加
- [ ] decisions.md / patterns.md の関連エントリをキーワードで抽出して表示

### Task 8.5: フック発動表示（ガードレール可視化） `[feature:observability]` `pm:確認済` `priority:medium`
- [ ] PreToolUse/PostToolUse 相当のイベントを UI で可視化（最低限: ブロック理由を表示）
- [ ] フック実行ログをメッセージ一覧に統合（ノイズにならない粒度で）

### Task 8.6: 品質ダッシュボード統合（Health を Agent に寄せる） `[feature:integration]` `pm:確認済` `priority:medium`
- [ ] Agent 画面ヘッダー/サイドパネルに Health のミニ表示を追加（Dashboard の `HealthScore` 再利用）
- [ ] 問題検出時に「推奨アクション（コマンド）」を提示（修正は自動実行しない）

---

## 📋 フェーズ9: 2エージェント運用サポート `pm:確認済`

### Task 9.1: PM/Impl モード切り替え `[feature:workflow]` `cc:完了`
- [x] Agent 画面にモード切り替えスイッチ追加（2-Agent モード時に表示）
- [x] PM モード: レビュー待ちタスク + 承認ボタン
- [x] Impl モード: 依頼タスク + 開始/完了ボタン

### Task 9.2: ハンドオフ状態可視化 `[feature:workflow]` `cc:完了`
- [x] 「PM待ち」「Impl待ち」状態の表示（`handoff-status` インジケーター）
- [x] ハンドオフカウント表示（PM待ち/Impl待ち/WIP）
- [x] ハンドオフボタン（承認/開始/完了 → Plans.md マーカー更新）

---

## 優先順位サマリー

| Priority | タスク | 理由 |
|----------|--------|------|
| 🔴 High | 8.1, 8.2, 8.3 | ハーネスの核心価値を可視化 |
| 🟡 Medium | 8.4, 8.5, 8.6 | 体験向上・運用効率化 |
| 🟢 Lower | 9.1, 9.2 | 拡張機能（2エージェント運用）|
