# Plans.md - harness-ui 品質改善

## 概要
- **目的**: コードレビュー（Security B, Performance A-, Quality B, Accessibility B）の指摘修正
- **対象**: harness-ui フロントエンド・バックエンド
- **状態**: ✅ 完了

---

## ✅ フェーズ1: セキュリティ修正 `cc:DONE`

### Task 1.1: projects.ts にパス検証を追加 `[feature:security]`
- [x] `addProject()` に `validateProjectPath` 検証を追加
- [x] `updateProject()` に `validateProjectPath` 検証を追加
- [x] `getProjectByPath()` に `validateProjectPath` 検証を追加
- [x] 無効なパスの場合は適切なエラーをスロー

---

## ✅ フェーズ2: アクセシビリティ修正 `cc:DONE`

### Task 2.1: モーダルにフォーカストラップを追加 `[feature:a11y]`
- [x] `DetailModal` にフォーカストラップを実装
- [x] ESC キーでモーダルを閉じる機能を追加
- [x] モーダル開閉時のフォーカス管理（開く前の要素に戻る）
- [x] `role="dialog"` と `aria-modal="true"` を追加

### Task 2.2: タブに ARIA パターンを追加 `[feature:a11y]`
- [x] タブリストに `role="tablist"` を追加
- [x] 各タブに `role="tab"` と `aria-selected` を追加
- [x] タブパネルに `role="tabpanel"` と `aria-labelledby` を追加
- [x] キーボードナビゲーション（矢印キー）を実装

---

## ✅ フェーズ3: 品質改善（コード重複解消） `cc:DONE`

### Task 3.1: 共通コンポーネントの抽出
- [x] `LoadingState` コンポーネントを作成
- [x] `ErrorState` コンポーネントを作成
- [x] 各コンポーネントから共通コンポーネントに置き換え

**作成ファイル**:
- `src/client/components/shared/LoadingState.tsx`
- `src/client/components/shared/ErrorState.tsx`
- `src/client/components/shared/index.ts`

### Task 3.2: getTokenStatus ユーティリティの共通化
- [x] `getTokenStatus` 関数を共通ユーティリティに抽出
- [x] `getSkillsTokenStatus` 関数を追加（Skills 用閾値）
- [x] `getMemoryTokenStatus` 関数を追加（Memory 用閾値）
- [x] 各コンポーネントから利用

**作成ファイル**: `src/client/lib/tokenStatus.ts`

---

## ✅ フェーズ4: パフォーマンス最適化 `cc:DONE`

### Task 4.1: useCallback の追加
- [x] `UsageManager.tsx` の `handleItemClick` を `useCallback` でラップ
- [x] `UsageManager.tsx` の `handleTabKeyDown` を `useCallback` でラップ
- [x] `SkillsManager.tsx` の `toggleCategory` を `useCallback` でラップ
- [x] `RulesEditor.tsx` の `toggleCategory` を `useCallback` でラップ
- [x] `InsightsPanel.tsx` の `copyCommand`, `clearInsights` を `useCallback` でラップ

### Task 4.2: 派生データの useMemo 化
- [x] `InsightsPanel.tsx`: `sortedInsights`, `stats` を `useMemo` でメモ化
- [x] `SkillsManager.tsx`: `groupedSkills`, `categories` を `useMemo` でメモ化
- [x] `RulesEditor.tsx`: `groupedRules`, `userRules` 等を `useMemo` でメモ化

---

## ✅ フェーズ5: 検証 `cc:DONE`

- [x] ビルド検証 (`bun run build`) - 成功
- [x] 型チェック - ソースコードエラーなし

---

## ✅ フェーズ6: プロジェクト自動登録 `cc:DONE`

### Task 6.1: SessionStart hook でプロジェクト自動登録 `[feature:integration]`
- [x] `scripts/harness-ui-register.sh` スクリプトを作成
  - harness-ui API (`/api/projects`) に POST してプロジェクトを登録
  - サーバーが起動していない場合は静かに失敗（エラー出力なし）
- [x] ハーネスの `hooks/hooks.json` に統合
- [x] 動作検証（別プロジェクトで Claude Code 起動 → harness-ui に追加される）

**期待動作**:
```
任意のプロジェクトで Claude Code 起動
    ↓
SessionStart hook が発火
    ↓
harness-ui API に POST
    ↓
プロジェクトが自動登録される（既存なら lastAccessedAt 更新）
```

---

## 完了サマリー

| フェーズ | 状態 | 変更ファイル数 |
|---------|------|----------------|
| 1. Security | ✅ 完了 | 1 |
| 2. Accessibility | ✅ 完了 | 1 |
| 3. Quality | ✅ 完了 | 7 |
| 4. Performance | ✅ 完了 | 4 |
| 5. Verify | ✅ 完了 | - |
| 6. Auto-register | ✅ 完了 | 2 |

**合計**: 9 タスク完了
