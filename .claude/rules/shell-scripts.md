---
description: シェルスクリプト編集時のルール
paths: "scripts/**/*.sh"
---

# Shell Scripts Rules

`scripts/` ディレクトリのシェルスクリプト編集時に適用されるルール。

## 必須パターン

### 1. ヘッダー形式

```bash
#!/bin/bash
# スクリプト名.sh
# スクリプトの目的を1行で説明
#
# Usage: ./scripts/スクリプト名.sh [引数]

set -euo pipefail
```

### 2. フック用 JSON 出力形式

フックスクリプト（`*-hook.sh`, `stop-*.sh` など）は JSON で結果を返す:

```bash
# 成功時
echo '{"decision": "approve", "reason": "説明"}'

# 警告時
echo '{"decision": "approve", "reason": "説明", "systemMessage": "ユーザーへの通知"}'

# 拒否時
echo '{"decision": "deny", "reason": "理由"}'
```

### 3. 環境変数の扱い

```bash
# CLAUDE_PLUGIN_ROOT は必ず存在確認
if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  echo "Error: CLAUDE_PLUGIN_ROOT not set" >&2
  exit 1
fi

# PROJECT_ROOT のフォールバック
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
```

## 禁止事項

- ❌ `set -e` なしでの実行
- ❌ 未クォートの変数展開（`$VAR` → `"$VAR"`）
- ❌ 絶対パスのハードコード
- ❌ `cd` での作業ディレクトリ変更（相対パスを使用）

## Windows 互換性

Git Bash / MSYS2 環境を考慮:

```bash
# パス区切りは / を使用
local file_path="${dir}/${filename}"

# run-script.js 経由の場合は自動で対応済み
```

## テスト

新規スクリプトは `tests/validate-plugin.sh` で参照確認されることを保証。
