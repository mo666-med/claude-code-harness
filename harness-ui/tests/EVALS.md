# Evals: Policy-Driven Guardrails + Deliver Workflow

## 評価シナリオ

### Scenario P1: ポリシー変更の反映

**目的**: codeパスのEditを `ask→auto` に切替 → 次のEdit要求が自動許可され、Ledgerに auto が残る

**手順**:
1. PolicySettings で preset を `fast` に変更（または code/tool_edit を `allow` に設定）
2. Agent Console でタスクを選択して実行開始
3. Agent が code パスの Edit 操作を要求
4. **期待結果**: 
   - 自動承認される（UI承認ダイアログが表示されない）
   - LedgerPanel に `auto` ステータスでイベントが記録される
   - 操作が正常に実行される

**検証ポイント**:
- [ ] PolicySettings の変更が即座に反映される
- [ ] Ledger に `auto` ステータスで記録される
- [ ] 操作が正常に実行される

---

### Scenario P2: 保護パスの強制承認

**目的**: ProtectedPaths の Edit を試みる → 常に ask/deny になり、locked の理由が表示される

**手順**:
1. PolicySettings で preset を `fast` に変更（可能な限り自動承認にする）
2. Agent Console でタスクを選択して実行開始
3. Agent が `Plans.md` または `.claude/memory/decisions.md` への Edit 操作を要求
4. **期待結果**:
   - 常に UI承認ダイアログが表示される（自動承認されない）
   - PolicySettings で locked として表示され、理由が表示される
   - Ledger に `pending` ステータスで記録される

**検証ポイント**:
- [ ] preset を `fast` にしても保護パスは自動承認されない
- [ ] PolicySettings で locked として表示される
- [ ] locked の理由が表示される
- [ ] Ledger に `pending` で記録される

---

### Scenario D1: Deliver ワークフロー（正常系）

**目的**: preflight → commit提案 → push提案 → PR作成（GitHub + `gh`）まで通る

**前提条件**:
- GitHub CLI (`gh`) がインストールされている
- GitHub リポジトリに接続されている
- feature ブランチで作業中

**手順**:
1. Agent Console でタスクを完了し、Review Report を生成
2. DeliverPanel を開く
3. Preflight で現在の状態を確認
4. Commit メッセージを確認・編集してコミット実行
5. Push ボタンをクリックしてプッシュ実行
6. PR タイトル・本文を確認・編集して PR作成実行
7. **期待結果**:
   - Preflight で branch/dirty/staged/ahead-behind が正しく表示される
   - Commit が成功し、commit hash が表示される
   - Push が成功する
   - PR が作成され、PR URL が表示される

**検証ポイント**:
- [ ] Preflight 情報が正確に表示される
- [ ] Commit が正常に実行される
- [ ] Push が正常に実行される
- [ ] PR が正常に作成される
- [ ] PR URL が正しく表示される

---

### Scenario D2: main/master ブランチ保護

**目的**: main/master への push 提案はブロックされ、理由と回避策が表示される

**前提条件**:
- `main` または `master` ブランチで作業中

**手順**:
1. Agent Console でタスクを完了
2. DeliverPanel を開く
3. Preflight で `main`/`master` ブランチであることを確認
4. Push ボタンをクリック
5. **期待結果**:
   - Push ボタンが無効化されている、または警告メッセージが表示される
   - 「main/master ブランチへの push は原則禁止です」というメッセージが表示される
   - 回避策（feature ブランチへの切り替えなど）が案内される

**検証ポイント**:
- [ ] Push ボタンが無効化されている、または警告が表示される
- [ ] 理由が明確に表示される
- [ ] 回避策が案内される

---

## 実行方法

### 1. ユニットテスト実行

```bash
cd harness-ui
bun test tests/unit/policy-engine.test.ts
```

### 2. 統合テスト実行

```bash
cd harness-ui
bun test tests/integration/deliver-preflight.test.ts
```

### 3. 手動Evals実行

1. `harness-ui` を起動: `bun run dev`
2. ブラウザで `http://localhost:37778` を開く
3. 上記のシナリオを順番に実行
4. 各検証ポイントをチェック

---

## 期待される結果

- **Policy Engine**: すべてのユニットテストがパスする
- **Deliver Preflight**: すべての統合テストがパスする
- **UI統合**: すべてのEvalsシナリオが期待通りに動作する
- **型チェック**: `bun run typecheck` が成功する

---

## トラブルシューティング

### Policy Engine が期待通りに動作しない

- `policy-engine.ts` の `PRESET_RULES` と `LOCKED_RULES` を確認
- `inferPathCategory` と `inferOperationKind` のロジックを確認
- ブラウザのコンソールでエラーログを確認

### Deliver Preflight が失敗する

- Git リポジトリが正しく初期化されているか確認
- `projectPath` が正しく渡されているか確認
- サーバーログでエラーを確認

### UI コンポーネントが表示されない

- `AgentConsole.tsx` に LedgerPanel/PolicySettings/DeliverPanel が統合されているか確認
- CSS スタイルが正しく読み込まれているか確認
- ブラウザのコンソールでエラーを確認
