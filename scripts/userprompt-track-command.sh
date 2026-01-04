#!/bin/bash
# userprompt-track-command.sh
# UserPromptSubmit時にスラッシュコマンドを検知してusage記録
# + Skill必須コマンドの pending 作成
#
# Usage: UserPromptSubmit hook から自動実行
# Input: stdin JSON (Claude Code hooks)
# Output: JSON (continue)

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR=".claude/state"
PENDING_DIR="${STATE_DIR}/pending-skills"
RECORD_USAGE="$SCRIPT_DIR/record-usage.js"

# Skill必須コマンド一覧
# これらのコマンドはSkill toolを使うことが期待される
SKILL_REQUIRED_COMMANDS="work|harness-review|validate|plan-with-agent"

# JSONから値を抽出（jq優先）
json_get() {
  local json="$1"
  local key="$2"
  local default="${3:-}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r "$key // \"$default\"" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
}

# stdin から JSON 入力を読み取る
INPUT=""
if [ ! -t 0 ]; then
  INPUT="$(cat 2>/dev/null)"
fi

[ -z "$INPUT" ] && { echo '{"continue":true}'; exit 0; }

# prompt を抽出
PROMPT=$(json_get "$INPUT" ".prompt" "")

# 空のプロンプトはスキップ
[ -z "$PROMPT" ] && { echo '{"continue":true}'; exit 0; }

# スラッシュコマンドを検知（行頭が /xxx で始まる）
# 複数行の場合は最初の行のみチェック
FIRST_LINE=$(echo "$PROMPT" | head -n1)

if [[ "$FIRST_LINE" =~ ^/([a-zA-Z0-9_:/-]+) ]]; then
  RAW_COMMAND="${BASH_REMATCH[1]}"

  # コマンド名を正規化（プラグインプレフィックスを除去）
  # /claude-code-harness:core:work → work
  # /claude-code-harness/work → work
  # /work → work
  COMMAND_NAME="$RAW_COMMAND"
  # claude-code-harness:xxx:yyy → yyy（最後のセグメント）
  if [[ "$COMMAND_NAME" =~ ^claude-code-harness[:/] ]]; then
    COMMAND_NAME=$(echo "$COMMAND_NAME" | sed 's|.*[:/]||')
  fi

  # コマンド使用を記録
  if [ -f "$RECORD_USAGE" ] && [ -n "$COMMAND_NAME" ]; then
    node "$RECORD_USAGE" command "$COMMAND_NAME" 2>/dev/null || true
  fi

  # Skill必須コマンドかチェック
  if echo "$COMMAND_NAME" | grep -qiE "^($SKILL_REQUIRED_COMMANDS)$"; then
    # pending ディレクトリ作成
    mkdir -p "$PENDING_DIR"

    # pending ファイル作成（タイムスタンプ付き）
    PENDING_FILE="${PENDING_DIR}/${COMMAND_NAME}.pending"
    cat > "$PENDING_FILE" <<EOF
{
  "command": "$COMMAND_NAME",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "prompt_preview": "$(echo "$PROMPT" | head -c 200 | tr '\n' ' ' | sed 's/"/\\"/g')"
}
EOF
  fi
fi

echo '{"continue":true}'
exit 0
