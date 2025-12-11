#!/bin/bash
# auto-cleanup-hook.sh
# PostToolUse Hook: Plans.md 等への書き込み後に自動でサイズチェック
#
# 入力: stdin から JSON（tool_name, tool_input 等）
# 出力: additionalContext でフィードバック

set -e

# 入力JSONを読み取り
INPUT=$(cat)

# tool_input から file_path を取得
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# file_path が空なら終了
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# デフォルト閾値
PLANS_MAX_LINES=${PLANS_MAX_LINES:-200}
SESSION_LOG_MAX_LINES=${SESSION_LOG_MAX_LINES:-500}
CLAUDE_MD_MAX_LINES=${CLAUDE_MD_MAX_LINES:-100}

# フィードバックを格納する変数
FEEDBACK=""

# Plans.md のチェック
if [[ "$FILE_PATH" == *"Plans.md"* ]] || [[ "$FILE_PATH" == *"plans.md"* ]]; then
  if [ -f "$FILE_PATH" ]; then
    lines=$(wc -l < "$FILE_PATH" | tr -d ' ')
    if [ "$lines" -gt "$PLANS_MAX_LINES" ]; then
      FEEDBACK="⚠️ Plans.md が ${lines} 行です（上限: ${PLANS_MAX_LINES}行）。/cleanup plans で古いタスクをアーカイブすることを推奨します。"
    fi
  fi
fi

# session-log.md のチェック
if [[ "$FILE_PATH" == *"session-log.md"* ]]; then
  if [ -f "$FILE_PATH" ]; then
    lines=$(wc -l < "$FILE_PATH" | tr -d ' ')
    if [ "$lines" -gt "$SESSION_LOG_MAX_LINES" ]; then
      FEEDBACK="⚠️ session-log.md が ${lines} 行です（上限: ${SESSION_LOG_MAX_LINES}行）。/cleanup sessions で月別に分割することを推奨します。"
    fi
  fi
fi

# CLAUDE.md のチェック
if [[ "$FILE_PATH" == *"CLAUDE.md"* ]] || [[ "$FILE_PATH" == *"claude.md"* ]]; then
  if [ -f "$FILE_PATH" ]; then
    lines=$(wc -l < "$FILE_PATH" | tr -d ' ')
    if [ "$lines" -gt "$CLAUDE_MD_MAX_LINES" ]; then
      FEEDBACK="⚠️ CLAUDE.md が ${lines} 行です。.claude/rules/ への分割、または docs/ に移動して @docs/filename.md で参照することを検討してください。"
    fi
  fi
fi

# フィードバックがあれば JSON で出力
if [ -n "$FEEDBACK" ]; then
  echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PostToolUse\", \"additionalContext\": \"$FEEDBACK\"}}"
fi

# 常に成功で終了
exit 0
