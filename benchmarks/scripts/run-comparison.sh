#!/bin/bash
# ======================================
# 比較試験実行スクリプト
# ======================================
#
# with-plugin vs no-plugin の比較試験を実行し、
# 統計分析を行います。
#
# Usage:
#   ./run-comparison.sh [--iterations N] [--task TASK]
#
# Examples:
#   ./run-comparison.sh --iterations 5
#   ./run-comparison.sh --iterations 3 --task plan-feature
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCHMARK_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$BENCHMARK_DIR/results"

# デフォルト設定
ITERATIONS=5
TASK="plan-feature"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ヘルプ
show_help() {
  cat << EOF
比較試験実行スクリプト

with-plugin vs no-plugin の比較試験を実行し、統計分析を行います。

Usage: $0 [OPTIONS]

OPTIONS:
  --iterations <n>    各モードの試行回数（デフォルト: 5）
  --task <name>       テストするタスク（デフォルト: plan-feature）
  --help              このヘルプを表示

EXAMPLES:
  # N=5 で比較試験
  $0 --iterations 5

  # N=3 で特定タスク
  $0 --iterations 3 --task plan-feature

PREREQUISITES:
  - OAuth セッションが有効であること（claude login 済み）
  - または ANTHROPIC_API_KEY が設定されていること
EOF
}

# 引数解析
while [[ $# -gt 0 ]]; do
  case "$1" in
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --task)
      TASK="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

echo ""
echo "========================================"
echo "🔬 比較試験: with-plugin vs no-plugin"
echo "========================================"
echo "タスク: $TASK"
echo "試行回数: $ITERATIONS（各モード）"
echo "タイムスタンプ: $TIMESTAMP"
echo "========================================"
echo ""

# 結果ディレクトリを作成
mkdir -p "$RESULTS_DIR"

# ======================================
# Phase 1: with-plugin 試行
# ======================================
echo "📦 Phase 1: with-plugin モード ($ITERATIONS 回)"
echo "----------------------------------------"

for ((i=1; i<=ITERATIONS; i++)); do
  echo ""
  echo "▶ with-plugin 試行 $i/$ITERATIONS"
  bash "$SCRIPT_DIR/run-workflow-benchmark.sh" \
    --task "$TASK" \
    --with-plugin \
    --no-temp-home \
    --iteration "$i" \
    || echo "⚠️ 試行 $i でエラーが発生しましたが続行します"
done

# ======================================
# Phase 2: no-plugin 試行
# ======================================
echo ""
echo "📋 Phase 2: no-plugin モード ($ITERATIONS 回)"
echo "----------------------------------------"

for ((i=1; i<=ITERATIONS; i++)); do
  echo ""
  echo "▶ no-plugin 試行 $i/$ITERATIONS"
  bash "$SCRIPT_DIR/run-workflow-benchmark.sh" \
    --task "$TASK" \
    --no-temp-home \
    --iteration "$i" \
    || echo "⚠️ 試行 $i でエラーが発生しましたが続行します"
done

# ======================================
# Phase 3: 統計分析
# ======================================
echo ""
echo "📊 Phase 3: 統計分析"
echo "----------------------------------------"

# 結果ファイルを集計
WITH_PLUGIN_FILES=$(ls -1 "$RESULTS_DIR"/${TASK}_*with-plugin*.json 2>/dev/null | tail -$ITERATIONS || true)
NO_PLUGIN_FILES=$(ls -1 "$RESULTS_DIR"/${TASK}_*no-plugin*.json 2>/dev/null | tail -$ITERATIONS || true)

if [[ -z "$WITH_PLUGIN_FILES" || -z "$NO_PLUGIN_FILES" ]]; then
  echo "⚠️ 十分な結果ファイルがありません"
  echo "結果ディレクトリ: $RESULTS_DIR"
  exit 1
fi

# 簡易統計を表示
echo ""
echo "=== with-plugin 結果 ==="
echo "$WITH_PLUGIN_FILES" | while read f; do
  if [[ -f "$f" ]]; then
    duration=$(jq -r '.duration_seconds // 0' "$f" 2>/dev/null)
    score=$(jq -r '.grade.score // 0' "$f" 2>/dev/null)
    cost=$(jq -r '.estimated_cost_usd // 0' "$f" 2>/dev/null)
    echo "  $(basename "$f"): ${duration}s, score=$score, \$${cost}"
  fi
done

echo ""
echo "=== no-plugin 結果 ==="
echo "$NO_PLUGIN_FILES" | while read f; do
  if [[ -f "$f" ]]; then
    duration=$(jq -r '.duration_seconds // 0' "$f" 2>/dev/null)
    score=$(jq -r '.grade.score // 0' "$f" 2>/dev/null)
    cost=$(jq -r '.estimated_cost_usd // 0' "$f" 2>/dev/null)
    echo "  $(basename "$f"): ${duration}s, score=$score, \$${cost}"
  fi
done

# 詳細分析（analyze-results.sh を使用）
if [[ -x "$SCRIPT_DIR/analyze-results.sh" ]]; then
  echo ""
  echo "=== 詳細分析 ==="
  bash "$SCRIPT_DIR/analyze-results.sh" --task "$TASK" --latest $((ITERATIONS * 2)) 2>/dev/null || true
fi

echo ""
echo "========================================"
echo "✅ 比較試験完了"
echo "========================================"
echo "結果ディレクトリ: $RESULTS_DIR"
echo ""
echo "次のステップ:"
echo "  1. 結果を確認: ls $RESULTS_DIR/${TASK}_*"
echo "  2. 詳細分析: ./analyze-results.sh --task $TASK"
echo ""
