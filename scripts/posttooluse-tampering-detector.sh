#!/bin/bash
# posttooluse-tampering-detector.sh
# テスト改ざんパターンを検出して警告する（ブロックはしない）
#
# 用途: PostToolUse で Write|Edit 後に実行
# 動作:
#   - テストファイル（*.test.*, *.spec.*）への変更を監視
#   - 改ざんパターン（skip化、アサーション削除、eslint-disable）を検出
#   - 検出した場合は警告を additionalContext として出力
#   - ログに記録（.claude/state/tampering.log）
#
# 出力: JSON形式で hookSpecificOutput.additionalContext に警告を出力
#       → Claude Code が system-reminder として表示

set -euo pipefail

# ===== 入力の取得 =====
INPUT=""
if [ ! -t 0 ]; then
  INPUT="$(cat 2>/dev/null || true)"
fi

[ -z "$INPUT" ] && exit 0

# ===== JSON パース =====
TOOL_NAME=""
FILE_PATH=""
OLD_STRING=""
NEW_STRING=""
CONTENT=""

if command -v jq >/dev/null 2>&1; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
  OLD_STRING=$(echo "$INPUT" | jq -r '.tool_input.old_string // empty' 2>/dev/null || true)
  NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty' 2>/dev/null || true)
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null || true)
elif command -v python3 >/dev/null 2>&1; then
  eval "$(echo "$INPUT" | python3 - <<'PY' 2>/dev/null || true
import json, shlex, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
tool_name = data.get("tool_name") or ""
tool_input = data.get("tool_input") or {}
file_path = tool_input.get("file_path") or ""
old_string = tool_input.get("old_string") or ""
new_string = tool_input.get("new_string") or ""
content = tool_input.get("content") or ""
print(f"TOOL_NAME={shlex.quote(tool_name)}")
print(f"FILE_PATH={shlex.quote(file_path)}")
print(f"OLD_STRING={shlex.quote(old_string)}")
print(f"NEW_STRING={shlex.quote(new_string)}")
print(f"CONTENT={shlex.quote(content)}")
PY
)"
fi

# Write/Edit 以外はスキップ
[[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]] && exit 0

# ファイルパスがなければスキップ
[ -z "$FILE_PATH" ] && exit 0

# ===== テストファイル判定 =====
is_test_file() {
  local path="$1"
  case "$path" in
    *.test.ts|*.test.tsx|*.test.js|*.test.jsx) return 0 ;;
    *.spec.ts|*.spec.tsx|*.spec.js|*.spec.jsx) return 0 ;;
    *.test.py|test_*.py|*_test.py) return 0 ;;
    *.test.go|*_test.go) return 0 ;;
    */__tests__/*|*/tests/*) return 0 ;;
  esac
  return 1
}

# lint/CI 設定ファイル判定
is_config_file() {
  local path="$1"
  case "$path" in
    .eslintrc*|eslint.config.*) return 0 ;;
    .prettierrc*|prettier.config.*) return 0 ;;
    tsconfig.json|tsconfig.*.json) return 0 ;;
    biome.json|.stylelintrc*) return 0 ;;
    jest.config.*|vitest.config.*) return 0 ;;
    .github/workflows/*.yml|.github/workflows/*.yaml) return 0 ;;
    .gitlab-ci.yml|Jenkinsfile) return 0 ;;
  esac
  return 1
}

# テストファイルでも設定ファイルでもなければスキップ
if ! is_test_file "$FILE_PATH" && ! is_config_file "$FILE_PATH"; then
  exit 0
fi

# ===== 改ざんパターン検出 =====
WARNINGS=""

# 検出対象のコンテンツ
CHECK_CONTENT="${NEW_STRING}${CONTENT}"

# テストファイルの改ざん検出
if is_test_file "$FILE_PATH"; then
  # skip 化検出
  if echo "$CHECK_CONTENT" | grep -qE '\bit\.skip\s*\(|\bdescribe\.skip\s*\(|\btest\.skip\s*\(|\bxit\s*\(|\bxdescribe\s*\('; then
    WARNINGS="${WARNINGS}⚠️ テストの skip 化を検出 (it.skip/describe.skip/xit)\n"
  fi

  # .only 化検出（他のテストを無効化）
  if echo "$CHECK_CONTENT" | grep -qE '\bit\.only\s*\(|\bdescribe\.only\s*\(|\btest\.only\s*\(|\bfit\s*\(|\bfdescribe\s*\('; then
    WARNINGS="${WARNINGS}⚠️ テストの .only 化を検出（他のテストが実行されなくなります）\n"
  fi

  # eslint-disable 追加検出
  if echo "$CHECK_CONTENT" | grep -qE 'eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck'; then
    WARNINGS="${WARNINGS}⚠️ lint/型チェック無効化コメントを検出\n"
  fi

  # expect 削除検出（Edit の場合）
  if [ -n "$OLD_STRING" ] && [ -n "$NEW_STRING" ]; then
    OLD_EXPECTS=$(echo "$OLD_STRING" | grep -c 'expect\s*(' || true)
    NEW_EXPECTS=$(echo "$NEW_STRING" | grep -c 'expect\s*(' || true)
    if [ "$OLD_EXPECTS" -gt 0 ] && [ "$NEW_EXPECTS" -lt "$OLD_EXPECTS" ]; then
      WARNINGS="${WARNINGS}⚠️ アサーション削除を検出 (expect: ${OLD_EXPECTS} → ${NEW_EXPECTS})\n"
    fi
  fi

  # assert 削除検出（Python）
  if [ -n "$OLD_STRING" ] && [ -n "$NEW_STRING" ]; then
    OLD_ASSERTS=$(echo "$OLD_STRING" | grep -cE '\bassert\b|self\.assert' || true)
    NEW_ASSERTS=$(echo "$NEW_STRING" | grep -cE '\bassert\b|self\.assert' || true)
    if [ "$OLD_ASSERTS" -gt 0 ] && [ "$NEW_ASSERTS" -lt "$OLD_ASSERTS" ]; then
      WARNINGS="${WARNINGS}⚠️ アサーション削除を検出 (assert: ${OLD_ASSERTS} → ${NEW_ASSERTS})\n"
    fi
  fi
fi

# 設定ファイルの緩和検出
if is_config_file "$FILE_PATH"; then
  # eslint ルール無効化
  if echo "$CHECK_CONTENT" | grep -qE '"off"|: *0|"warn".*→.*"off"'; then
    WARNINGS="${WARNINGS}⚠️ lint ルールの無効化を検出\n"
  fi

  # CI continue-on-error
  if echo "$CHECK_CONTENT" | grep -qE 'continue-on-error:\s*true'; then
    WARNINGS="${WARNINGS}⚠️ CI の continue-on-error 追加を検出\n"
  fi

  # strict モードの緩和
  if echo "$CHECK_CONTENT" | grep -qE '"strict"\s*:\s*false|"noImplicitAny"\s*:\s*false'; then
    WARNINGS="${WARNINGS}⚠️ TypeScript strict モードの緩和を検出\n"
  fi
fi

# ===== 警告がなければ終了 =====
[ -z "$WARNINGS" ] && exit 0

# ===== ログに記録 =====
STATE_DIR=".claude/state"
LOG_FILE="$STATE_DIR/tampering.log"

if [ -d "$STATE_DIR" ] || mkdir -p "$STATE_DIR" 2>/dev/null; then
  echo "[$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')] FILE=$FILE_PATH TOOL=$TOOL_NAME" >> "$LOG_FILE" 2>/dev/null || true
  echo -e "$WARNINGS" | sed 's/^/  /' >> "$LOG_FILE" 2>/dev/null || true
fi

# ===== 警告を出力 =====
# Claude が次のターンで見られるように additionalContext として出力
WARNING_MSG="[Tampering Detector] テスト/設定ファイルの変更で以下のパターンを検出しました：

$(echo -e "$WARNINGS")
ファイル: $FILE_PATH

これが意図的な変更であれば問題ありませんが、テスト改ざんの可能性があります。

⚠️ テスト改ざん（skip化、アサーション削除）ではなく、実装の修正が正しい対応です。
⚠️ 設定の緩和ではなく、コードの修正が正しい対応です。"

# JSON 出力
if command -v jq >/dev/null 2>&1; then
  jq -nc --arg ctx "$WARNING_MSG" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
else
  # jq がない場合は最小限のエスケープで出力
  ESCAPED_MSG=$(echo "$WARNING_MSG" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"${ESCAPED_MSG}\"}}"
fi

exit 0
