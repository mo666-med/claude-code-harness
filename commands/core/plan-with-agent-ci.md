---
description: CI用・非対話の計画作成（ベンチマーク専用）
description-en: CI-only non-interactive planning (benchmark use)
user-invocable: false
---

# /plan-with-agent-ci - CI専用計画作成

**ベンチマーク専用**: 非対話で Plans.md を生成します。

## 制約（CI用）

- **AskUserQuestion 禁止**: 質問せずに進める
- **WebSearch 禁止**: 外部検索なしで進める
- **確認プロンプト禁止**: 自動で完了まで進める

## 入力

コマンド引数として要件（タスクプロンプト）を受け取る:

```
/plan-with-agent-ci <要件テキスト>
```

## 出力

`benchmarks/test-project/Plans.md` を生成/更新:

```markdown
## タスク一覧

- [ ] タスク1の説明 `cc:TODO`
- [ ] タスク2の説明 `cc:TODO`
- [ ] タスク3の説明 `cc:TODO`
```

## 実行手順

1. **要件の解析**: 引数から要件を抽出
2. **タスク分解**: 実装可能な単位に分解（3-7個程度）
3. **Plans.md 生成**: `benchmarks/test-project/Plans.md` に書き込み
4. **完了出力**: 生成したタスク数を報告

## 成功基準

- Plans.md が存在する
- 3つ以上のタスクが `cc:TODO` マーカー付きで記載されている
- 各タスクが実装可能な具体的な内容である

## 失敗時

- エラーをログに出力して終了（途中で止まらない）
- Plans.md が生成できなかった理由を明記
