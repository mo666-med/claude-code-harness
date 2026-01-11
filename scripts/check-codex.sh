#!/bin/bash
# check-codex.sh - Codex 利用可能性チェック（once hook 用）
# /harness-review 初回実行時に一度だけ実行される

set -euo pipefail

# プロジェクト設定ファイルのパス
CONFIG_FILE=".claude-code-harness.config.yaml"

# 既に codex.enabled が設定されているか確認
if [[ -f "$CONFIG_FILE" ]]; then
    if grep -q "codex:" "$CONFIG_FILE" 2>/dev/null; then
        # 既に設定済みの場合は何もしない
        exit 0
    fi
fi

# Codex CLI がインストールされているか確認
if ! command -v codex &> /dev/null; then
    # Codex がない場合は何もしない
    exit 0
fi

# Codex が見つかった場合、ユーザーに通知
cat << 'EOF'

🤖 Codex が検出されました

Codex（OpenAI CLI）を使ったセカンドオピニオンレビューが利用可能です。

有効化するには、以下のいずれかを実行してください：

1. 設定ファイルに追加:
   review:
     codex:
       enabled: true

2. または `/codex-review` で個別に Codex レビューを実行

詳細: skills/codex-review/SKILL.md

EOF

exit 0
