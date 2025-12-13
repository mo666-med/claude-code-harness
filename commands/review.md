---
description: （互換）/harness-review へ移行（組み込み /review との衝突回避）
disable-model-invocation: true
---

# /review（互換） - /harness-review へ移行

Claude Code には組み込みの `/review` が存在し、プラグインの `/review` は衝突します。

今後は **`/harness-review`** を使用してください。

- **推奨**: `/harness-review`
- **衝突時の明示呼び出し**: `/claude-code-harness:harness-review`
- **旧名（このコマンド）**: `/claude-code-harness:review`（非推奨・移行用）

このコマンドは互換性のために残していますが、内容は `/harness-review` を前提に更新されます。
