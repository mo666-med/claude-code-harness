#!/bin/bash
# skill-child-reminder.sh
# PostToolUse hook: Skill ツール使用後に子スキルの読み込みをリマインド
#
# Usage: PostToolUse hook から自動実行（matcher="Skill"）
# Input: stdin JSON (Claude Code hooks)
# Output: リマインダーメッセージ（子スキルがある場合）

set +e

# stdin から JSON 入力を読み取る
INPUT=""
if [ ! -t 0 ]; then
  INPUT="$(cat 2>/dev/null)"
fi

[ -z "$INPUT" ] && exit 0

# JSON からツール名とスキル名を抽出
TOOL_NAME=""
SKILL_NAME=""

if command -v jq >/dev/null 2>&1; then
  TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)"
  SKILL_NAME="$(echo "$INPUT" | jq -r '.tool_input.skill // empty' 2>/dev/null)"
elif command -v python3 >/dev/null 2>&1; then
  eval "$(echo "$INPUT" | python3 - <<'PY' 2>/dev/null
import json, shlex, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
tool_name = data.get("tool_name") or ""
tool_input = data.get("tool_input") or {}
skill_name = tool_input.get("skill") or ""
print(f"TOOL_NAME={shlex.quote(tool_name)}")
print(f"SKILL_NAME={shlex.quote(skill_name)}")
PY
)"
fi

# Skill ツール以外はスキップ
[ "$TOOL_NAME" != "Skill" ] && exit 0
[ -z "$SKILL_NAME" ] && exit 0

# プラグインルートを取得
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(realpath "$0")")")}"

# スキル名からカテゴリを抽出（例: "claude-code-harness:impl" → "impl"）
SKILL_CATEGORY="${SKILL_NAME##*:}"

# 子スキルディレクトリの存在確認
SKILL_DIR="${PLUGIN_ROOT}/skills/${SKILL_CATEGORY}"

if [ -d "$SKILL_DIR" ]; then
  # 子スキル（doc.md）の一覧を取得
  CHILD_SKILLS=""
  for child_dir in "$SKILL_DIR"/*/; do
    if [ -f "${child_dir}doc.md" ]; then
      child_name=$(basename "$child_dir")
      CHILD_SKILLS="${CHILD_SKILLS}  - ${SKILL_CATEGORY}/${child_name}/doc.md\n"
    fi
  done

  # 子スキルがある場合のみリマインダーを出力
  if [ -n "$CHILD_SKILLS" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📚 Skill Hierarchy Reminder"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "「${SKILL_CATEGORY}」スキルには以下の子スキルがあります："
    echo ""
    echo -e "$CHILD_SKILLS"
    echo ""
    echo "⚠️  ユーザーの意図に応じて、該当する doc.md を Read してください。"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
  fi
fi

exit 0
