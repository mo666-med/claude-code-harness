#!/bin/bash
# code-grader.sh - コードベースグレーダー
#
# Plans.md と生成物を分析し、定量的なスコアを算出する。
# Anthropic Evals ガイドライン準拠: 高速、決定論的、再現可能
#
# 使用法:
#   ./code-grader.sh <project_dir> [--json]
#
# 出力:
#   各グレーダーのスコアと重み付きトータルスコア

set -euo pipefail

# デフォルト値
PROJECT_DIR="${1:-.}"
OUTPUT_FORMAT="text"

# オプション解析
for arg in "$@"; do
  case $arg in
    --json)
      OUTPUT_FORMAT="json"
      shift
      ;;
  esac
done

# 結果ディレクトリに移動
cd "$PROJECT_DIR"

# === グレーダー定義 ===

# 1. Plans.md 存在チェック
grade_plans_exists() {
  if [[ -f "Plans.md" ]]; then
    echo 1
  else
    echo 0
  fi
}

# 2. Plans.md 行数（計画の詳細度）
grade_plans_line_count() {
  if [[ -f "Plans.md" ]]; then
    wc -l < Plans.md | tr -d ' '
  else
    echo 0
  fi
}

# 3. フェーズ数（計画の構造化度）
grade_phase_count() {
  if [[ -f "Plans.md" ]]; then
    local count
    count=$(grep -cE '^##.*フェーズ|^## Phase' Plans.md 2>/dev/null) || count=0
    echo "$count"
  else
    echo 0
  fi
}

# 4. TDD マーカー数
grade_tdd_markers() {
  if [[ -f "Plans.md" ]]; then
    local count
    count=$(grep -c '\[feature:tdd\]' Plans.md 2>/dev/null) || count=0
    echo "$count"
  else
    echo 0
  fi
}

# 5. セキュリティマーカー数
grade_security_markers() {
  if [[ -f "Plans.md" ]]; then
    local count
    count=$(grep -c '\[feature:security\]' Plans.md 2>/dev/null) || count=0
    echo "$count"
  else
    echo 0
  fi
}

# 6. テストケース表の存在
grade_test_table_exists() {
  if [[ -f "Plans.md" ]]; then
    # テストケース表のヘッダーパターンを検出
    if grep -qE '\|.*テストケース.*\||Test.*Case.*\|' Plans.md 2>/dev/null; then
      echo 1
    else
      echo 0
    fi
  else
    echo 0
  fi
}

# 7. テストファイル数
grade_test_files_created() {
  find . -name '*.test.ts' -o -name '*.spec.ts' -o -name '*.test.js' -o -name '*.spec.js' 2>/dev/null | wc -l | tr -d ' '
}

# 8. 明確化質問数（曖昧さの解消）
grade_clarification_questions() {
  if [[ -f "Plans.md" ]]; then
    local count
    count=$(grep -cE '(確認|質問|どの|どれ|どう|？|\?)' Plans.md 2>/dev/null) || count=0
    echo "$count"
  else
    echo 0
  fi
}

# 11. ユーザーの誤解・間違いへの対応
grade_user_misunderstanding_addressed() {
  if [[ -f "Plans.md" ]]; then
    # ユーザーの誤解を指摘・解決したパターンを検出
    local count
    # 「〜ではなく」「〜の代わりに」「実際には」「正確には」などの訂正表現
    count=$(grep -cE '(ではなく|代わりに|実際には|正確には|つまり|要するに|具体的には|整理すると|ヒアリング|回答・決定)' Plans.md 2>/dev/null) || count=0
    echo "$count"
  else
    echo 0
  fi
}

# 9. API エンドポイント設計の存在
grade_api_design() {
  if [[ -f "Plans.md" ]]; then
    # API エンドポイント表のパターンを検出
    if grep -qE '\|.*(GET|POST|PUT|DELETE|PATCH).*\||\|.*エンドポイント.*\|' Plans.md 2>/dev/null; then
      echo 1
    else
      echo 0
    fi
  else
    echo 0
  fi
}

# 10. 実装ファイル数
grade_impl_files_created() {
  find . -path './node_modules' -prune -o \( -name '*.ts' -o -name '*.js' \) -print 2>/dev/null | grep -v node_modules | grep -v '\.test\.' | grep -v '\.spec\.' | wc -l | tr -d ' '
}

# === 行数スコア変換 ===
convert_line_count_to_score() {
  local lines=$1
  if [[ $lines -eq 0 ]]; then
    echo 0
  elif [[ $lines -le 20 ]]; then
    echo 1
  elif [[ $lines -le 50 ]]; then
    echo 2
  elif [[ $lines -le 100 ]]; then
    echo 3
  else
    echo 4
  fi
}

# === メイン実行 ===

# グレーダー実行時は一時的に set -e を無効化（grep -c がマッチなしで exit 1 を返すため）
set +e

# 各グレーダーを実行
PLANS_EXISTS=$(grade_plans_exists)
PLANS_LINE_COUNT=$(grade_plans_line_count)
PLANS_LINE_SCORE=$(convert_line_count_to_score "$PLANS_LINE_COUNT")
PHASE_COUNT=$(grade_phase_count)
TDD_MARKERS=$(grade_tdd_markers)
SECURITY_MARKERS=$(grade_security_markers)
TEST_TABLE_EXISTS=$(grade_test_table_exists)
TEST_FILES_CREATED=$(grade_test_files_created)
CLARIFICATION_QUESTIONS=$(grade_clarification_questions)
API_DESIGN=$(grade_api_design)
IMPL_FILES_CREATED=$(grade_impl_files_created)
USER_MISUNDERSTANDING=$(grade_user_misunderstanding_addressed)

# グレーダー実行完了、エラーチェックを再有効化
set -e

# 重み定義
W_PLANS_EXISTS=2.0
W_PLANS_LINE=1.0
W_PHASE_COUNT=1.0
W_TDD_MARKERS=1.5
W_SECURITY_MARKERS=1.5
W_TEST_TABLE=1.5
W_TEST_FILES=1.0
W_CLARIFICATION=1.0
W_API_DESIGN=1.0
W_IMPL_FILES=0.5
W_USER_MISUNDERSTANDING=1.5  # Codex指摘: ユーザーの誤解への対応を加点

# 重み付きスコア計算（awk で浮動小数点対応）
WEIGHTED_SCORE=$(awk "BEGIN {
  score = 0
  score += $PLANS_EXISTS * $W_PLANS_EXISTS
  score += $PLANS_LINE_SCORE * $W_PLANS_LINE
  score += ($PHASE_COUNT > 5 ? 5 : $PHASE_COUNT) * $W_PHASE_COUNT * 0.5
  score += ($TDD_MARKERS > 3 ? 3 : $TDD_MARKERS) * $W_TDD_MARKERS
  score += ($SECURITY_MARKERS > 3 ? 3 : $SECURITY_MARKERS) * $W_SECURITY_MARKERS
  score += $TEST_TABLE_EXISTS * $W_TEST_TABLE
  score += ($TEST_FILES_CREATED > 5 ? 5 : $TEST_FILES_CREATED) * $W_TEST_FILES * 0.5
  score += ($CLARIFICATION_QUESTIONS > 5 ? 5 : $CLARIFICATION_QUESTIONS) * $W_CLARIFICATION * 0.2
  score += $API_DESIGN * $W_API_DESIGN
  score += ($IMPL_FILES_CREATED > 10 ? 10 : $IMPL_FILES_CREATED) * $W_IMPL_FILES * 0.2
  score += ($USER_MISUNDERSTANDING > 5 ? 5 : $USER_MISUNDERSTANDING) * $W_USER_MISUNDERSTANDING * 0.3
  printf \"%.2f\", score
}")

# 最大スコア（すべて最高値の場合）
MAX_SCORE=$(awk "BEGIN {
  max = 0
  max += 1 * $W_PLANS_EXISTS
  max += 4 * $W_PLANS_LINE
  max += 5 * $W_PHASE_COUNT * 0.5
  max += 3 * $W_TDD_MARKERS
  max += 3 * $W_SECURITY_MARKERS
  max += 1 * $W_TEST_TABLE
  max += 5 * $W_TEST_FILES * 0.5
  max += 5 * $W_CLARIFICATION * 0.2
  max += 1 * $W_API_DESIGN
  max += 10 * $W_IMPL_FILES * 0.2
  max += 5 * $W_USER_MISUNDERSTANDING * 0.3
  printf \"%.2f\", max
}")

# 正規化スコア（0-100）
NORMALIZED_SCORE=$(awk "BEGIN { printf \"%.1f\", ($WEIGHTED_SCORE / $MAX_SCORE) * 100 }")

# === 出力 ===

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  cat <<EOF
{
  "graders": {
    "plans_exists": {"value": $PLANS_EXISTS, "weight": $W_PLANS_EXISTS},
    "plans_line_count": {"value": $PLANS_LINE_COUNT, "score": $PLANS_LINE_SCORE, "weight": $W_PLANS_LINE},
    "phase_count": {"value": $PHASE_COUNT, "weight": $W_PHASE_COUNT},
    "tdd_markers": {"value": $TDD_MARKERS, "weight": $W_TDD_MARKERS},
    "security_markers": {"value": $SECURITY_MARKERS, "weight": $W_SECURITY_MARKERS},
    "test_table_exists": {"value": $TEST_TABLE_EXISTS, "weight": $W_TEST_TABLE},
    "test_files_created": {"value": $TEST_FILES_CREATED, "weight": $W_TEST_FILES},
    "clarification_questions": {"value": $CLARIFICATION_QUESTIONS, "weight": $W_CLARIFICATION},
    "api_design": {"value": $API_DESIGN, "weight": $W_API_DESIGN},
    "impl_files_created": {"value": $IMPL_FILES_CREATED, "weight": $W_IMPL_FILES},
    "user_misunderstanding": {"value": $USER_MISUNDERSTANDING, "weight": $W_USER_MISUNDERSTANDING}
  },
  "weighted_score": $WEIGHTED_SCORE,
  "max_score": $MAX_SCORE,
  "normalized_score": $NORMALIZED_SCORE,
  "project_dir": "$PROJECT_DIR"
}
EOF
else
  echo "=== Code-Based Grader Results ==="
  echo ""
  echo "Project: $PROJECT_DIR"
  echo ""
  echo "| Grader                  | Value | Weight |"
  echo "|-------------------------|-------|--------|"
  printf "| %-23s | %5d | %6.1f |\n" "plans_exists" "$PLANS_EXISTS" "$W_PLANS_EXISTS"
  printf "| %-23s | %5d | %6.1f | (raw lines: %d)\n" "plans_line_score" "$PLANS_LINE_SCORE" "$W_PLANS_LINE" "$PLANS_LINE_COUNT"
  printf "| %-23s | %5d | %6.1f |\n" "phase_count" "$PHASE_COUNT" "$W_PHASE_COUNT"
  printf "| %-23s | %5d | %6.1f |\n" "tdd_markers" "$TDD_MARKERS" "$W_TDD_MARKERS"
  printf "| %-23s | %5d | %6.1f |\n" "security_markers" "$SECURITY_MARKERS" "$W_SECURITY_MARKERS"
  printf "| %-23s | %5d | %6.1f |\n" "test_table_exists" "$TEST_TABLE_EXISTS" "$W_TEST_TABLE"
  printf "| %-23s | %5d | %6.1f |\n" "test_files_created" "$TEST_FILES_CREATED" "$W_TEST_FILES"
  printf "| %-23s | %5d | %6.1f |\n" "clarification_questions" "$CLARIFICATION_QUESTIONS" "$W_CLARIFICATION"
  printf "| %-23s | %5d | %6.1f |\n" "api_design" "$API_DESIGN" "$W_API_DESIGN"
  printf "| %-23s | %5d | %6.1f |\n" "impl_files_created" "$IMPL_FILES_CREATED" "$W_IMPL_FILES"
  printf "| %-23s | %5d | %6.1f |\n" "user_misunderstanding" "$USER_MISUNDERSTANDING" "$W_USER_MISUNDERSTANDING"
  echo ""
  echo "Weighted Score: $WEIGHTED_SCORE / $MAX_SCORE"
  echo "Normalized Score: $NORMALIZED_SCORE / 100"
fi
