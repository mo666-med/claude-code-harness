#!/usr/bin/env bash
# ======================================
# 曖昧プロンプト比較実行スクリプト (Evals v3)
# ======================================
#
# 同じ曖昧なプロンプトを with-plugin / no-plugin で実行し、
# プラグインが曖昧な指示を構造化する価値を測定する
#
# Usage:
#   ./run-vague-comparison.sh --task VP-01 --iterations 3
#   ./run-vague-comparison.sh --all --iterations 5
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="$(dirname "$EVALS_DIR")"
PLUGIN_ROOT="$(dirname "$BENCHMARK_DIR")"
RESULTS_DIR="$EVALS_DIR/results"
TEST_PROJECT="$BENCHMARK_DIR/test-project"
TASKS_FILE="$EVALS_DIR/tasks/vague-prompts.yaml"

# デフォルト設定
TASK_ID=""
ALL_TASKS=false
ITERATIONS=3
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# === YAML からタスク定義を読み込む（SSOT） ===
# Python ヘルパーを使用して確実にパース
declare -A TASK_PROMPTS

load_tasks_from_yaml() {
  local yaml_file="$1"
  local parser="$SCRIPT_DIR/parse-tasks-yaml.py"

  if ! [[ -f "$yaml_file" ]]; then
    echo "Error: YAML file not found: $yaml_file" >&2
    exit 1
  fi

  if ! [[ -f "$parser" ]]; then
    echo "Error: YAML parser not found: $parser" >&2
    exit 1
  fi

  # Python パーサーでプロンプトを取得（ID|prompt 形式）
  while IFS='|' read -r task_id prompt; do
    if [[ -n "$task_id" ]]; then
      TASK_PROMPTS["$task_id"]="$prompt"
    fi
  done < <(python3 "$parser" "$yaml_file" --prompts)
}

load_tasks_from_yaml "$TASKS_FILE"

# 曖昧プロンプト取得関数（YAML から読み込んだ値を返す）
get_vague_prompt() {
  echo "${TASK_PROMPTS[$1]:-}"
}

# ヘルプ
show_help() {
  cat << EOF
曖昧プロンプト比較実行スクリプト (Evals v3)

同じ曖昧なプロンプトを with-plugin / no-plugin で実行し、
プラグインが曖昧な指示を構造化する価値を測定する。

Usage: $0 [OPTIONS]

OPTIONS:
  --task <id>       タスクID（YAML で定義されたもの）
  --all             全タスクを実行
  --iterations <n>  各タスクの試行回数（デフォルト: 3）
  --help            このヘルプを表示

EXAMPLES:
  # 単一タスクを3回試行
  $0 --task VP-01 --iterations 3

  # 全タスクを5回ずつ試行
  $0 --all --iterations 5

TASKS (from $TASKS_FILE):
EOF
  # YAML からタスク一覧を動的に表示
  for task_id in "${!TASK_PROMPTS[@]}"; do
    local prompt="${TASK_PROMPTS[$task_id]}"
    # プロンプトを短縮表示（最初の30文字）
    local short_prompt="${prompt:0:30}"
    [[ ${#prompt} -gt 30 ]] && short_prompt="${short_prompt}..."
    echo "  $task_id: 「$short_prompt」"
  done | sort
}

# 引数解析
while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK_ID="$2"
      shift 2
      ;;
    --all)
      ALL_TASKS=true
      shift
      ;;
    --iterations)
      ITERATIONS="$2"
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

# パラメータチェック
if [[ -z "$TASK_ID" && "$ALL_TASKS" != "true" ]]; then
  echo "Error: --task or --all is required"
  show_help
  exit 1
fi

# 結果ディレクトリ作成
mkdir -p "$RESULTS_DIR"

# ======================================
# テストプロジェクトのセットアップ
# ======================================
setup_test_project() {
  local task_id=$1

  echo "📁 テストプロジェクトをセットアップ..."

  # クリーンアップ
  rm -rf "$TEST_PROJECT"
  mkdir -p "$TEST_PROJECT/src"
  mkdir -p "$TEST_PROJECT/.claude/memory"
  mkdir -p "$TEST_PROJECT/.claude/state"

  # package.json
  cat > "$TEST_PROJECT/package.json" << 'EOF'
{
  "name": "vague-prompt-test",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
EOF

  # tsconfig.json
  cat > "$TEST_PROJECT/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
EOF

  # 基本ファイル
  cat > "$TEST_PROJECT/src/index.ts" << 'EOF'
// Test Project for Vague Prompt Evaluation
export function main() {
  console.log("Vague Prompt Test Project");
}
EOF

  # VP-03 用のバグファイル
  if [[ "$task_id" == "VP-03" ]]; then
    cat > "$TEST_PROJECT/src/utils.ts" << 'EOF'
export function calculate(a: number, b: number): number {
  return a / b;  // バグ: ゼロ除算チェックなし
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
EOF
  fi

  echo "   → $TEST_PROJECT"
}

# ======================================
# 単一試行の実行
# ======================================
run_single_trial() {
  local task_id=$1
  local iteration=$2
  local mode=$3  # with-plugin or no-plugin

  local vague_prompt=$(get_vague_prompt "$task_id")
  local result_file="$RESULTS_DIR/${task_id}_${mode}_${iteration}_${TIMESTAMP}.json"
  local output_file="$RESULTS_DIR/${task_id}_${mode}_${iteration}_${TIMESTAMP}.output.txt"

  echo ""
  echo "▶ $task_id - $mode - 試行 $iteration"
  echo "  プロンプト: 「$vague_prompt」"

  # テストプロジェクトをセットアップ
  setup_test_project "$task_id"

  # 開始時刻
  local start_time=$(date +%s)

  # プロンプトを構築
  local full_prompt=""
  if [[ "$mode" == "with-plugin" ]]; then
    full_prompt="/claude-code-harness:core:plan-with-agent $vague_prompt"
  else
    full_prompt="$vague_prompt"
  fi

  # Claude を実行
  # Note: with-plugin モードでは既にインストール済みのプラグインを使用
  # no-plugin モードではスラッシュコマンドなしで実行
  local exit_code=0
  cd "$TEST_PROJECT"

  claude -p "$full_prompt" --dangerously-skip-permissions > "$output_file" 2>&1 || exit_code=$?

  cd - > /dev/null

  # 終了時刻
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # グレーディング
  local plans_exists="false"
  local plans_task_count=0
  local test_files_count=0
  local security_markers=0

  if [[ -f "$TEST_PROJECT/Plans.md" ]]; then
    plans_exists="true"
    plans_task_count=$(grep -c '^\s*- \[' "$TEST_PROJECT/Plans.md" 2>/dev/null || echo 0)
    security_markers=$(grep -c '\[feature:security\]' "$TEST_PROJECT/Plans.md" 2>/dev/null || echo 0)
  fi

  test_files_count=$(find "$TEST_PROJECT" -name '*.test.ts' -o -name '*.spec.ts' 2>/dev/null | wc -l | tr -d ' ')

  # スコア計算（簡易）
  local score=0
  [[ "$plans_exists" == "true" ]] && score=$((score + 30))
  [[ $plans_task_count -gt 0 ]] && score=$((score + 20))
  [[ $test_files_count -gt 0 ]] && score=$((score + 25))
  [[ $security_markers -gt 0 ]] && score=$((score + 15))
  [[ $exit_code -eq 0 ]] && score=$((score + 10))

  # 結果JSON
  cat > "$result_file" << EOF
{
  "task_id": "$task_id",
  "mode": "$mode",
  "iteration": $iteration,
  "timestamp": "$TIMESTAMP",
  "vague_prompt": "$vague_prompt",
  "exit_code": $exit_code,
  "duration_seconds": $duration,
  "grade": {
    "plans_exists": $plans_exists,
    "plans_task_count": $plans_task_count,
    "test_files_count": $test_files_count,
    "security_markers": $security_markers,
    "score": $score
  },
  "output_file": "$output_file"
}
EOF

  echo "  結果: score=$score, plans=$plans_exists, tests=$test_files_count, ${duration}s"
}

# ======================================
# タスクの比較実行
# ======================================
run_task_comparison() {
  local task_id=$1
  local vague_prompt=$(get_vague_prompt "$task_id")

  echo ""
  echo "========================================"
  echo "🔬 タスク: $task_id"
  echo "   プロンプト: 「$vague_prompt」"
  echo "   試行回数: $ITERATIONS"
  echo "========================================"

  # with-plugin を実行
  echo ""
  echo "📦 Phase 1: with-plugin"
  for ((i=1; i<=ITERATIONS; i++)); do
    run_single_trial "$task_id" "$i" "with-plugin"
  done

  # no-plugin を実行
  echo ""
  echo "📋 Phase 2: no-plugin"
  for ((i=1; i<=ITERATIONS; i++)); do
    run_single_trial "$task_id" "$i" "no-plugin"
  done
}

# ======================================
# 結果分析
# ======================================
analyze_results() {
  echo ""
  echo "========================================"
  echo "📊 結果分析"
  echo "========================================"

  # 各タスクの結果を集計（YAML から読み込んだタスク）
  for task in "${!TASK_PROMPTS[@]}"; do
    local vague_prompt=$(get_vague_prompt "$task")
    [[ -z "$vague_prompt" ]] && continue

    local wp_files=$(find "$RESULTS_DIR" -name "${task}_with-plugin_*_${TIMESTAMP}.json" 2>/dev/null | head -$ITERATIONS)
    local np_files=$(find "$RESULTS_DIR" -name "${task}_no-plugin_*_${TIMESTAMP}.json" 2>/dev/null | head -$ITERATIONS)

    if [[ -n "$wp_files" && -n "$np_files" ]]; then
      echo ""
      echo "### $task: 「$vague_prompt」"

      # with-plugin の統計
      local wp_plans=0
      local wp_tests=0
      local wp_score_sum=0
      local wp_count=0
      for f in $wp_files; do
        if [[ -f "$f" ]]; then
          local score=$(jq -r '.grade.score' "$f" 2>/dev/null)
          local plans=$(jq -r '.grade.plans_exists' "$f" 2>/dev/null)
          local tests=$(jq -r '.grade.test_files_count' "$f" 2>/dev/null)
          wp_score_sum=$((wp_score_sum + score))
          wp_count=$((wp_count + 1))
          [[ "$plans" == "true" ]] && wp_plans=$((wp_plans + 1))
          [[ "$tests" -gt 0 ]] && wp_tests=$((wp_tests + 1))
        fi
      done

      # no-plugin の統計
      local np_plans=0
      local np_tests=0
      local np_score_sum=0
      local np_count=0
      for f in $np_files; do
        if [[ -f "$f" ]]; then
          local score=$(jq -r '.grade.score' "$f" 2>/dev/null)
          local plans=$(jq -r '.grade.plans_exists' "$f" 2>/dev/null)
          local tests=$(jq -r '.grade.test_files_count' "$f" 2>/dev/null)
          np_score_sum=$((np_score_sum + score))
          np_count=$((np_count + 1))
          [[ "$plans" == "true" ]] && np_plans=$((np_plans + 1))
          [[ "$tests" -gt 0 ]] && np_tests=$((np_tests + 1))
        fi
      done

      local wp_avg=$((wp_count > 0 ? wp_score_sum / wp_count : 0))
      local np_avg=$((np_count > 0 ? np_score_sum / np_count : 0))

      echo "  with-plugin: plans=$wp_plans/$wp_count, tests=$wp_tests/$wp_count, avg_score=$wp_avg"
      echo "  no-plugin:   plans=$np_plans/$np_count, tests=$np_tests/$np_count, avg_score=$np_avg"
      echo "  差分:        score_diff=$((wp_avg - np_avg))"
    fi
  done
}

# ======================================
# メイン処理
# ======================================

echo ""
echo "========================================"
echo "🧪 Evals v3: 曖昧プロンプト比較"
echo "========================================"
echo "タイムスタンプ: $TIMESTAMP"

if [[ "$ALL_TASKS" == "true" ]]; then
  for task in "${!TASK_PROMPTS[@]}"; do
    run_task_comparison "$task"
  done | sort
else
  vague_prompt=$(get_vague_prompt "$TASK_ID")
  if [[ -z "$vague_prompt" ]]; then
    echo "Error: Unknown task ID: $TASK_ID"
    echo "Valid tasks: ${!TASK_PROMPTS[*]}"
    exit 1
  fi
  run_task_comparison "$TASK_ID"
fi

# 結果分析
analyze_results

echo ""
echo "========================================"
echo "✅ 評価完了"
echo "========================================"
echo "結果ディレクトリ: $RESULTS_DIR"
echo ""
