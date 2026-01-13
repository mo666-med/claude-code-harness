---
description: CI用・非対話の実装実行（ベンチマーク専用）
description-en: CI-only non-interactive implementation (benchmark use)
user-invocable: false
---

# /work-ci - CI専用実装実行

**ベンチマーク専用**: Plans.md のタスクを非対話で実装します。

## 制約（CI用）

- **AskUserQuestion 禁止**: 質問せずに進める
- **WebSearch 禁止**: 外部検索なしで進める
- **確認プロンプト禁止**: 自動で完了まで進める
- **ビルド検証**: 可能なら `npm test` / `npm run build` を実行

## 入力

`benchmarks/test-project/Plans.md` を読み込む。

## 実行手順

1. **Plans.md 読み込み**: `cc:TODO` マーカーのタスクを抽出
2. **順次実装**: 各タスクを実装
   - ファイル作成/編集
   - 必要に応じてテスト作成
3. **マーカー更新**: 完了したタスクを `cc:完了` に変更
4. **ビルド検証**: `npm test` または `npm run build` を実行（可能な場合）
5. **完了出力**: 実装結果のサマリーを報告

## 出力形式

```
## 実装結果

### 完了タスク
- [x] タスク1 `cc:完了`
- [x] タスク2 `cc:完了`

### 作成/変更ファイル
- src/utils/helper.ts (新規)
- src/index.ts (変更)

### ビルド結果
- テスト: 5/5 passed
- ビルド: success
```

## 成功基準

- 1つ以上のタスクが `cc:完了` になっている
- 実装したファイルが存在する
- ビルド/テストが通る（該当する場合）

## 失敗時

- エラーをログに出力して続行（途中で止まらない）
- 失敗したタスクは `cc:TODO` のまま残す
- 最終的な成功/失敗数を報告
