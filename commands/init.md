---
description: （互換）/harness-init へ移行（組み込み /init との衝突回避）
disable-model-invocation: true
---

# /init（互換） - /harness-init へ移行

Claude Code には組み込みの `/init` が存在し、プラグインの `/init` は衝突します。

今後は **`/harness-init`** を使用してください。

- **推奨**: `/harness-init`
- **衝突時の明示呼び出し**: `/claude-code-harness:harness-init`
- **旧名（このコマンド）**: `/claude-code-harness:init`（非推奨・移行用）
このコマンドは互換性のために残していますが、内容は `/harness-init` を前提に更新されます。
