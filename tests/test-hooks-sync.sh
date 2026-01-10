#!/bin/bash
# test-hooks-sync.sh
# hooks/hooks.json と .claude-plugin/hooks.json の同期を検証
#
# TDD: Phase 7 テストケース

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# テスト結果カウンター
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# テスト関数
run_test() {
  local test_name="$1"
  local test_func="$2"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -n "  Testing: $test_name... "

  if $test_func; then
    echo -e "${GREEN}PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# ==================================================
# Test 1: 両方のファイルが存在するか
# ==================================================
test_both_files_exist() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"
  local plugin_hooks_file="$PROJECT_ROOT/.claude-plugin/hooks.json"

  if [ ! -f "$hooks_file" ]; then
    echo "    Error: hooks/hooks.json not found"
    return 1
  fi

  if [ ! -f "$plugin_hooks_file" ]; then
    echo "    Error: .claude-plugin/hooks.json not found"
    return 1
  fi

  return 0
}

# ==================================================
# Test 2: 両ファイルの内容が同一か
# ==================================================
test_files_identical() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"
  local plugin_hooks_file="$PROJECT_ROOT/.claude-plugin/hooks.json"

  if diff -q "$hooks_file" "$plugin_hooks_file" > /dev/null 2>&1; then
    return 0
  else
    echo "    Error: Files are not identical"
    echo "    Run: ./scripts/sync-plugin-cache.sh to sync"
    return 1
  fi
}

# ==================================================
# Test 3: JSON が有効か
# ==================================================
test_valid_json() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"
  local plugin_hooks_file="$PROJECT_ROOT/.claude-plugin/hooks.json"

  if ! jq empty "$hooks_file" 2>/dev/null; then
    echo "    Error: hooks/hooks.json is not valid JSON"
    return 1
  fi

  if ! jq empty "$plugin_hooks_file" 2>/dev/null; then
    echo "    Error: .claude-plugin/hooks.json is not valid JSON"
    return 1
  fi

  return 0
}

# ==================================================
# Test 4: 必須フックイベントが存在するか
# ==================================================
test_required_hook_events() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  local required_events=("PreToolUse" "SessionStart" "Stop" "PostToolUse")
  local missing=""

  for event in "${required_events[@]}"; do
    if ! jq -e ".hooks.$event" "$hooks_file" > /dev/null 2>&1; then
      missing="${missing}$event, "
    fi
  done

  if [ -n "$missing" ]; then
    echo "    Error: Missing required events: ${missing%, }"
    return 1
  fi

  return 0
}

# ==================================================
# Test 5: 禁止パターン (type: "prompt" の不正使用) がないか
# ==================================================
test_no_forbidden_prompt_usage() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  # PreToolUse, PostToolUse, UserPromptSubmit で prompt 型は禁止
  # (セキュリティ上の理由 - D13)
  local forbidden_events=("PreToolUse" "PostToolUse" "UserPromptSubmit")
  local violations=""

  for event in "${forbidden_events[@]}"; do
    if jq -e ".hooks.$event[]?.hooks[]? | select(.type == \"prompt\")" "$hooks_file" > /dev/null 2>&1; then
      violations="${violations}$event, "
    fi
  done

  if [ -n "$violations" ]; then
    echo "    Error: type: prompt should not be used in: ${violations%, }"
    echo "    (Stop and SubagentStop are the only valid events for prompt type)"
    return 1
  fi

  return 0
}

# ==================================================
# メイン実行
# ==================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Hooks 同期テスト"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# jq が利用可能か確認
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}"
  exit 1
fi

run_test "両方の hooks.json が存在する" test_both_files_exist
run_test "hooks.json の内容が同一" test_files_identical
run_test "JSON が有効" test_valid_json
run_test "必須フックイベントが存在" test_required_hook_events
run_test "禁止された prompt 使用がない" test_no_forbidden_prompt_usage

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " テスト結果: $TESTS_PASSED/$TESTS_RUN passed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
