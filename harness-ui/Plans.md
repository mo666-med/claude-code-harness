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

## 📋 フェーズ10: Solo有料価値（速度×統制 + Review成果物） `pm:確認済`

> **狙い**: “チャットUI”から脱却し、Plan→Work→Review を **状態機械として強制**する。  
> **前提（方針）**: **ハードブロック**（抜け道なし）。止まらないUXは「ブロックしない」ではなく、**ブロックを即時解消できる導線**で作る。

### 背景 / 目的
- **背景**: 現状は Plan/Review が任意で、`cc:完了` が「根拠なし完了」になり得る（= harness思想がUIを支配していない）
- **目的**: Solo開発でも、Plan→Work→Review が **逸脱できないフロー**として成立する
- **有料価値**: ユーザーの思考を止めずに “次の一手” に導き、手作業より **速く・安全に**回せる

### スコープ（やる）
- タスク未選択の実行を **UIで禁止**（理由表示つき）
- Start Work を主要CTAに統一し、**開始時に `cc:WIP` へ遷移 → 成功後に実行**（失敗時は実行不可）
- 実行完了後は Review ステップへ自動遷移し、Review未完了の `cc:完了` を **UIで禁止**
- Review成果物（要約/確認手順/承認履歴/実行ログ要点）を **UIで生成・保持（セッション内）**

### 非スコープ（やらない）
- 2-agent（PM/Impl）前提の体験最適化（フェーズ9までで十分）
- Review成果物の永続化/共有（まずは **セッション内 + コピー導線**で十分）
- “理由を書けば抜けられる” 例外ルート（方針として不採用）

### 受入条件（測定可能）
- [ ] タスク未選択では Execute/Start Work が押せない（disabled + 理由が表示される）
- [ ] Start Work は `PATCH /api/plans/task` で `cc:WIP` 更新が成功した場合のみ実行に進む（失敗時は理由を表示）
- [ ] Reviewチェックが完了するまで `cc:完了` 更新ができない（disabled + 未完了項目が表示される）
- [ ] Reviewレポートが UI 上に残り、コピー可能（セッション内で再確認できる）
- [ ] `bun run typecheck` と `bun test` が通る

### 評価（Evals）
- **tasks（シナリオ）**:
  - Scenario S1: タスク未選択 → 実行できない → タスク選択で解消
  - Scenario S2: Start Work → `cc:WIP` に更新成功 → 実行開始（409/422/400 は実行に進まず理由表示）
  - Scenario S3: 実行完了 → Reviewへ遷移 → 未入力のまま `cc:完了` 不可 → 必須項目を埋めて完了できる
  - Scenario S4: Reviewレポートが自動ドラフトされ、コピーできる
- **graders（採点）**:
  - outcome:
    - `bun run typecheck`
    - `bun test`
  - transcript:
    - タスク未選択のまま実行できない（抜け道なし）
    - Review未完了のまま `cc:完了` にできない（抜け道なし）

### Task 10.1: UIワークフロー状態の導入（ゲーティング） `[feature:workflow]` `pm:確認済` `priority:high`
- [ ] AgentConsole に `sessionState`（idle/planned/working/needsReview/readyToComplete/completed）を導入
- [ ] タスク未選択時は Execute/Start Work を disabled にし、理由を表示
- [ ] 実行終了で `needsReview` に遷移し、Review導線を主導線にする（単一CTA）

### Task 10.2: Start Work 主導線（`cc:WIP`→実行の一体化） `[feature:ux]` `pm:確認済` `priority:high`
- [ ] Start Work を主要CTAに統一（迷わせない）
- [ ] Start Work で `PATCH /api/plans/task` を呼び、成功したら実行開始（失敗なら実行しない）
- [ ] 409/422/400 を UI で明示（「なぜ開始できないか」を隠さない）

### Task 10.3: Reviewチェックリスト必須化 + Review成果物ドラフト `[feature:ux]` `pm:確認済` `priority:high`
- [ ] Review必須項目（要約/確認手順）を導入し、未完了では `cc:完了` 更新を禁止
- [ ] Reviewレポートを自動ドラフト（選択タスク名 + 実行ログ要点 + 承認履歴を埋める）
- [ ] レポートをコピーできる導線を用意（セッション内で再確認できる）

### Task 10.4: permissionMode を安全デフォルトへ寄せる（思想と挙動の整合） `[feature:security]` `pm:確認済` `priority:high`
- [ ] `permissionMode` のデフォルトを `default` に変更（危険操作は承認フロー前提）
- [ ] 速度が必要な場合の明示トグルを検討するなら、**デフォルトOFF**で追加（v1で必須ではない）

### Task 10.5: 最小テスト + E2E手順の整備（CC-test） `[test]` `pm:確認済` `priority:medium`
- [ ] タスク未選択ゲート / Review未完了ゲートの最小テストを追加
- [ ] Evals（Scenario S1〜S4）の手順を README または Plans.md に追記（CC-test で再現可能に）

## 優先順位サマリー

| Priority | タスク | 理由 |
|----------|--------|------|
| 🔴 High | 10.1, 10.2, 10.3, 10.4 | 有料価値の核（速度×統制 + Review成果物） |
| 🔴 High | 8.1, 8.2, 8.3 | ハーネスの核心価値を可視化 |
| 🟡 Medium | 8.4, 8.5, 8.6 | 体験向上・運用効率化 |
| 🟡 Medium | 10.5 | 品質ゲート（抜け道が無いこと）をテストで担保 |
| 🟢 Lower | 9.1, 9.2 | 拡張機能（2エージェント運用）|
