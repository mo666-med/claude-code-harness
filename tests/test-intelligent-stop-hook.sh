#!/bin/bash
# test-intelligent-stop-hook.sh
# Intelligent Stop Hook (type: "prompt") のテスト
#
# TDD: Phase 1 テストケース - 実装前に作成

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
YELLOW='\033[1;33m'
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
# Test 1: hooks.json に prompt 型 Stop フックが存在するか
# ==================================================
test_prompt_stop_hook_exists() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  if [ ! -f "$hooks_file" ]; then
    echo "    Error: hooks.json not found"
    return 1
  fi

  # Stop フックに type: "prompt" が含まれているか確認
  if jq -e '.hooks.Stop[] | select(.hooks[]?.type == "prompt")' "$hooks_file" > /dev/null 2>&1; then
    return 0
  else
    echo "    Error: No prompt-type Stop hook found"
    return 1
  fi
}

# ==================================================
# Test 2: prompt 型フックに model パラメータが指定されているか
# ==================================================
test_prompt_hook_has_model() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  # model パラメータが指定されているか確認
  local model=$(jq -r '.hooks.Stop[] | .hooks[]? | select(.type == "prompt") | .model // empty' "$hooks_file" 2>/dev/null)

  if [ -n "$model" ]; then
    return 0
  else
    echo "    Error: No model parameter specified for prompt hook"
    return 1
  fi
}

# ==================================================
# Test 3: prompt 型フックに timeout が適切に設定されているか
# ==================================================
test_prompt_hook_timeout() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  # timeout が 30 秒以上であることを確認
  local timeout=$(jq -r '.hooks.Stop[] | .hooks[]? | select(.type == "prompt") | .timeout // 0' "$hooks_file" 2>/dev/null)

  if [ "$timeout" -ge 30 ]; then
    return 0
  else
    echo "    Error: Timeout should be >= 30 seconds, got $timeout"
    return 1
  fi
}

# ==================================================
# Test 4: prompt 文字列が必要な判定項目を含んでいるか
# ==================================================
test_prompt_content() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  local prompt=$(jq -r '.hooks.Stop[] | .hooks[]? | select(.type == "prompt") | .prompt // empty' "$hooks_file" 2>/dev/null)

  if [ -z "$prompt" ]; then
    echo "    Error: No prompt content found"
    return 1
  fi

  # 必要な判定項目が含まれているか
  local missing=""

  # タスク完了判定
  if ! echo "$prompt" | grep -qi "完了\|complete\|done\|finish"; then
    missing="${missing}タスク完了判定, "
  fi

  # エラー判定
  if ! echo "$prompt" | grep -qi "エラー\|error\|問題\|issue"; then
    missing="${missing}エラー判定, "
  fi

  # フォローアップ判定
  if ! echo "$prompt" | grep -qi "フォローアップ\|follow\|追加\|next"; then
    missing="${missing}フォローアップ判定, "
  fi

  if [ -n "$missing" ]; then
    echo "    Error: Missing criteria in prompt: ${missing%, }"
    return 1
  fi

  return 0
}

# ==================================================
# Test 5: command 型 session-summary が維持されているか
# ==================================================
test_session_summary_maintained() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  # session-summary.sh が command 型で維持されているか
  if jq -e '.hooks.Stop[] | .hooks[]? | select(.type == "command") | select(.command | contains("session-summary"))' "$hooks_file" > /dev/null 2>&1; then
    return 0
  else
    echo "    Error: session-summary command hook not found"
    return 1
  fi
}

# ==================================================
# Test 6: Stop フックの数が適切か（2つ: command + prompt）
# ==================================================
test_stop_hook_count() {
  local hooks_file="$PROJECT_ROOT/hooks/hooks.json"

  # Stop フック内の hooks 配列の総数を確認
  local hook_count=$(jq '[.hooks.Stop[].hooks[]] | length' "$hooks_file" 2>/dev/null)

  # 目標: session-summary (command) + intelligent-stop (prompt) = 2
  if [ "$hook_count" -le 3 ]; then
    return 0
  else
    echo "    Error: Expected 2-3 hooks in Stop, got $hook_count"
    return 1
  fi
}

# ==================================================
# メイン実行
# ==================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Intelligent Stop Hook テスト"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# jq が利用可能か確認
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}"
  exit 1
fi

echo "Phase 1: Intelligent Stop Hook 検証"
echo ""

run_test "prompt 型 Stop フックが存在する" test_prompt_stop_hook_exists
run_test "model パラメータが指定されている" test_prompt_hook_has_model
run_test "timeout が適切に設定されている (>= 30s)" test_prompt_hook_timeout
run_test "prompt に必要な判定項目が含まれている" test_prompt_content
run_test "session-summary (command) が維持されている" test_session_summary_maintained
run_test "Stop フックの数が適切 (<= 3)" test_stop_hook_count

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " テスト結果: $TESTS_PASSED/$TESTS_RUN passed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TESTS_FAILED" -gt 0 ]; then
  echo -e "${YELLOW}Note: これは TDD テストです。実装後に全て PASSED になることを確認してください。${NC}"
  exit 1
fi

exit 0
