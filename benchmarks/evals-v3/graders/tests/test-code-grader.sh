#!/bin/bash
# test-code-grader.sh - Code Grader Unit Tests
#
# Usage: ./test-code-grader.sh
#
# Exit codes:
#   0: All tests passed
#   1: One or more tests failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRADER="$SCRIPT_DIR/../code-grader.sh"
FIXTURES="$SCRIPT_DIR/fixtures"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# テスト結果を出力
pass() {
  echo -e "${GREEN}✓${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  echo -e "  ${YELLOW}Expected: $2${NC}"
  echo -e "  ${YELLOW}Actual:   $3${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

# テスト用一時ディレクトリを作成
setup_test_project() {
  local name="$1"
  local fixture="$2"
  local tmpdir
  tmpdir=$(mktemp -d)

  if [[ -f "$fixture" && -s "$fixture" ]]; then
    cp "$fixture" "$tmpdir/Plans.md"
  fi

  echo "$tmpdir"
}

# テスト用ディレクトリをクリーンアップ
cleanup_test_project() {
  local tmpdir="$1"
  rm -rf "$tmpdir"
}

# JSON から値を抽出
extract_json_value() {
  local json="$1"
  local key="$2"
  echo "$json" | grep -oE "\"$key\":\s*[0-9.]+\s*[,}]" | grep -oE '[0-9.]+' | head -1
}

# === テストケース ===

echo "=== Code Grader Unit Tests ==="
echo ""

# Test 1: Plans.md が存在しない場合
test_no_plans() {
  local tmpdir
  tmpdir=$(mktemp -d)

  local result
  result=$("$GRADER" "$tmpdir" --json 2>/dev/null)

  local plans_exists
  plans_exists=$(echo "$result" | grep -o '"plans_exists":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$plans_exists" == "0" ]]; then
    pass "No Plans.md: plans_exists = 0"
  else
    fail "No Plans.md: plans_exists should be 0" "0" "$plans_exists"
  fi

  cleanup_test_project "$tmpdir"
}

# Test 2: Minimal Plans.md
test_minimal_plans() {
  local tmpdir
  tmpdir=$(setup_test_project "minimal" "$FIXTURES/minimal-plans.md")

  local result
  result=$("$GRADER" "$tmpdir" --json 2>/dev/null)

  # plans_exists = 1
  local plans_exists
  plans_exists=$(echo "$result" | grep -o '"plans_exists":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$plans_exists" == "1" ]]; then
    pass "Minimal Plans.md: plans_exists = 1"
  else
    fail "Minimal Plans.md: plans_exists should be 1" "1" "$plans_exists"
  fi

  # phase_count >= 1
  local phase_count
  phase_count=$(echo "$result" | grep -o '"phase_count":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$phase_count" -ge 1 ]]; then
    pass "Minimal Plans.md: phase_count >= 1 (actual: $phase_count)"
  else
    fail "Minimal Plans.md: phase_count should be >= 1" ">=1" "$phase_count"
  fi

  cleanup_test_project "$tmpdir"
}

# Test 3: Comprehensive Plans.md
test_comprehensive_plans() {
  local tmpdir
  tmpdir=$(setup_test_project "comprehensive" "$FIXTURES/comprehensive-plans.md")

  local result
  result=$("$GRADER" "$tmpdir" --json 2>/dev/null)

  # plans_exists = 1
  local plans_exists
  plans_exists=$(echo "$result" | grep -o '"plans_exists":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$plans_exists" == "1" ]]; then
    pass "Comprehensive Plans.md: plans_exists = 1"
  else
    fail "Comprehensive Plans.md: plans_exists should be 1" "1" "$plans_exists"
  fi

  # phase_count >= 4
  local phase_count
  phase_count=$(echo "$result" | grep -o '"phase_count":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$phase_count" -ge 4 ]]; then
    pass "Comprehensive Plans.md: phase_count >= 4 (actual: $phase_count)"
  else
    fail "Comprehensive Plans.md: phase_count should be >= 4" ">=4" "$phase_count"
  fi

  # tdd_markers >= 2
  local tdd_markers
  tdd_markers=$(echo "$result" | grep -o '"tdd_markers":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$tdd_markers" -ge 2 ]]; then
    pass "Comprehensive Plans.md: tdd_markers >= 2 (actual: $tdd_markers)"
  else
    fail "Comprehensive Plans.md: tdd_markers should be >= 2" ">=2" "$tdd_markers"
  fi

  # security_markers >= 2
  local security_markers
  security_markers=$(echo "$result" | grep -o '"security_markers":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$security_markers" -ge 2 ]]; then
    pass "Comprehensive Plans.md: security_markers >= 2 (actual: $security_markers)"
  else
    fail "Comprehensive Plans.md: security_markers should be >= 2" ">=2" "$security_markers"
  fi

  # test_table_exists = 1
  local test_table
  test_table=$(echo "$result" | grep -o '"test_table_exists":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$test_table" == "1" ]]; then
    pass "Comprehensive Plans.md: test_table_exists = 1"
  else
    fail "Comprehensive Plans.md: test_table_exists should be 1" "1" "$test_table"
  fi

  # api_design = 1
  local api_design
  api_design=$(echo "$result" | grep -o '"api_design":\s*{\s*"value":\s*[0-9]*' | grep -oE '[0-9]+$')

  if [[ "$api_design" == "1" ]]; then
    pass "Comprehensive Plans.md: api_design = 1"
  else
    fail "Comprehensive Plans.md: api_design should be 1" "1" "$api_design"
  fi

  # normalized_score > 0
  local normalized_score
  normalized_score=$(echo "$result" | grep -o '"normalized_score":\s*[0-9.]*' | grep -oE '[0-9.]+')

  if echo "$normalized_score" | awk '{exit !($1 > 0)}'; then
    pass "Comprehensive Plans.md: normalized_score > 0 (actual: $normalized_score)"
  else
    fail "Comprehensive Plans.md: normalized_score should be > 0" ">0" "$normalized_score"
  fi

  cleanup_test_project "$tmpdir"
}

# Test 4: JSON 出力形式の検証
test_json_output_format() {
  local tmpdir
  tmpdir=$(setup_test_project "comprehensive" "$FIXTURES/comprehensive-plans.md")

  local result
  result=$("$GRADER" "$tmpdir" --json 2>/dev/null)

  # 必須フィールドの存在確認
  if echo "$result" | grep -q '"graders":'; then
    pass "JSON format: contains 'graders' field"
  else
    fail "JSON format: should contain 'graders' field" "present" "missing"
  fi

  if echo "$result" | grep -q '"weighted_score":'; then
    pass "JSON format: contains 'weighted_score' field"
  else
    fail "JSON format: should contain 'weighted_score' field" "present" "missing"
  fi

  if echo "$result" | grep -q '"normalized_score":'; then
    pass "JSON format: contains 'normalized_score' field"
  else
    fail "JSON format: should contain 'normalized_score' field" "present" "missing"
  fi

  # JSON の妥当性確認
  if echo "$result" | python3 -m json.tool > /dev/null 2>&1; then
    pass "JSON format: valid JSON syntax"
  else
    fail "JSON format: should be valid JSON" "valid" "invalid"
  fi

  cleanup_test_project "$tmpdir"
}

# Test 5: スコア範囲の検証（正規化スコアは 0-100）
test_score_range() {
  local tmpdir
  tmpdir=$(setup_test_project "comprehensive" "$FIXTURES/comprehensive-plans.md")

  local result
  result=$("$GRADER" "$tmpdir" --json 2>/dev/null)

  local normalized_score
  normalized_score=$(echo "$result" | grep -o '"normalized_score":\s*[0-9.]*' | grep -oE '[0-9.]+')

  if echo "$normalized_score" | awk '{exit !($1 >= 0 && $1 <= 100)}'; then
    pass "Score range: normalized_score in [0, 100] (actual: $normalized_score)"
  else
    fail "Score range: normalized_score should be in [0, 100]" "[0, 100]" "$normalized_score"
  fi

  cleanup_test_project "$tmpdir"
}

# === テスト実行 ===

echo "Running tests..."
echo ""

test_no_plans
test_minimal_plans
test_comprehensive_plans
test_json_output_format
test_score_range

echo ""
echo "=== Test Results ==="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
