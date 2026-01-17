#!/usr/bin/env bash
# run-statistical-eval.sh - 統計的評価トライアルランナー
#
# N=20+ の試行を自動実行し、結果を収集する。
# Anthropic Evals ガイドライン準拠: 統計的に有意な試行数
#
# 使用法:
#   ./run-statistical-eval.sh --task VP-05 --iterations 20
#   ./run-statistical-eval.sh --all --iterations 10
#
# 出力:
#   results/statistical/ 以下に試行結果を保存

set -euo pipefail

# === 設定 ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$EVALS_DIR/results/statistical"
TEST_PROJECT_BASE="/Users/tachibanashuuta/Desktop/Code/CC-harness/claude-code-harness/benchmarks/test-project"
# テスト実行ディレクトリ（ハーネスプロジェクト外に配置してcwd競合を回避）
WORK_BASE="/tmp/evals-v3-work"
GRADERS_DIR="$EVALS_DIR/graders"
TASKS_FILE="$EVALS_DIR/tasks/vague-prompts.yaml"

# デフォルト値
TASK_ID=""
ITERATIONS=20
RUN_ALL=false
TIMEOUT_SECONDS=180
DRY_RUN=false

# === ヘルプ ===
show_help() {
  cat <<EOF
統計的評価トライアルランナー

使用法:
  $0 --task <task_id> --iterations <n>
  $0 --all --iterations <n>

オプション:
  --task <id>       実行するタスク ID（例: VP-05）
  --all             すべてのタスクを実行
  --iterations <n>  試行回数（デフォルト: 20）
  --timeout <sec>   タイムアウト秒数（デフォルト: 180）
  --dry-run         実際の Claude 呼び出しをスキップ
  --help            このヘルプを表示

タスク一覧:
  VP-01: ユーザー管理機能追加（曖昧なスコープ）
  VP-02: ログイン画面作成（矛盾する要件）
  VP-03: バグ修正（情報不足）
  VP-04: リファクタ（主観的な基準）
  VP-05: API作成（技術的な曖昧さ）
EOF
}

# === 引数解析 ===
while [[ $# -gt 0 ]]; do
  case $1 in
    --task)
      TASK_ID="$2"
      shift 2
      ;;
    --all)
      RUN_ALL=true
      shift
      ;;
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
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

# バリデーション
if [[ -z "$TASK_ID" && "$RUN_ALL" != "true" ]]; then
  echo "Error: --task または --all を指定してください"
  show_help
  exit 1
fi

# Claude CLI の存在確認（早期エラー）
if [[ "$DRY_RUN" != "true" ]]; then
  if ! command -v claude >/dev/null 2>&1; then
    echo "Error: 'claude' CLI is required but not found."
    exit 1
  fi
fi

# プラグインディレクトリ
PLUGIN_DIR="/Users/tachibanashuuta/Desktop/Code/CC-harness/claude-code-harness"

# === YAML からタスク定義を読み込む（SSOT） ===
# Python ヘルパーを使用して確実にパース
# Note: 両方のコンディションで同じプロンプトを使用。差異は --plugin-dir の有無のみ

declare -A TASK_PROMPTS
declare -A TASK_ANSWERS

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

  # Python パーサーで全タスクを取得（ID|prompt 形式）
  while IFS='|' read -r task_id prompt; do
    if [[ -n "$task_id" ]]; then
      TASK_PROMPTS["$task_id"]="$prompt"
    fi
  done < <(python3 "$parser" "$yaml_file" --prompts)
}

# YAML からタスクを読み込み
load_tasks_from_yaml "$TASKS_FILE"

# タスク別の質問回答（非エンジニアの回答をシミュレート）
# Note: これは将来的に YAML に移動すべきだが、現状はインタラクションシミュレーション用
declare -A TASK_ANSWERS
TASK_ANSWERS["VP-01"]="とりあえずシンプルなやつでいい|メモリでいい、後でデータベースにできるなら|パスワードは安全に保存してほしい"
TASK_ANSWERS["VP-02"]="まずメールだけでいい、SNSは後で|シンプル優先で|なんかモダンな感じ"
TASK_ANSWERS["VP-03"]="エラーメッセージはよくわからない|たぶん昨日から|全部直して"
TASK_ANSWERS["VP-04"]="src フォルダ全部|読みやすければいい|テストがあるなら動かして確認して"
TASK_ANSWERS["VP-05"]="ユーザー情報を表示したい|とりあえず動けばいい|シンプル優先で"

# === ユーティリティ関数 ===

# タイムスタンプ取得
timestamp() {
  date "+%Y-%m-%d_%H-%M-%S"
}

# プロジェクトディレクトリの初期化
init_project_dir() {
  local dir="$1"

  # クリーンな状態にリセット
  rm -rf "$dir"
  mkdir -p "$dir"

  # 基本ファイルをコピー
  cp "$TEST_PROJECT_BASE/package.json" "$dir/" 2>/dev/null || true
  cp "$TEST_PROJECT_BASE/tsconfig.json" "$dir/" 2>/dev/null || true
  mkdir -p "$dir/src"

  # 最小限の index.ts を作成
  cat > "$dir/src/index.ts" <<'INDEXTS'
// 評価用テストプロジェクト
export function main() {
  console.log("Test project initialized");
}
INDEXTS

  # CLAUDE.md を作成（Claude Code が認識するため）
  cat > "$dir/CLAUDE.md" <<'CLAUDEMD'
# Test Project for Evals

This is a test project for evaluating Claude Code plugin effectiveness.
CLAUDEMD
}

# Claude CLI を -p モードで実行（非インタラクティブ）
# Note: expect ベースから -p モードに変更。より信頼性が高い。
run_claude_with_print_mode() {
  local project_dir="$1"
  local prompt="$2"
  local timeout="$3"
  local output_file="$4"
  local use_plugin="$5"  # "true" or "false"

  cd "$project_dir"

  # タイムアウト付きで実行（バックグラウンドプロセス + wait）
  local pid
  if [[ "$use_plugin" == "true" ]]; then
    # プラグイン有効
    echo "$prompt" | claude -p --dangerously-skip-permissions --plugin-dir "$PLUGIN_DIR" > "$output_file" 2>&1 &
    pid=$!
  else
    # プラグイン無効（素の Claude）
    echo "$prompt" | claude -p --dangerously-skip-permissions > "$output_file" 2>&1 &
    pid=$!
  fi

  # タイムアウト監視
  local elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [[ $elapsed -ge $timeout ]]; then
      echo "TIMEOUT after ${timeout}s" >> "$output_file"
      kill "$pid" 2>/dev/null || true
      break
    fi
  done

  wait "$pid" 2>/dev/null || true

  cd - >/dev/null
}

# グレーディングを実行
run_grading() {
  local project_dir="$1"
  local result_file="$2"

  # コードベースグレーダー
  local code_result
  code_result=$("$GRADERS_DIR/code-grader.sh" "$project_dir" --json)

  # モデルベースグレーダー（モック使用）
  local model_result
  model_result=$(python3 "$GRADERS_DIR/model-grader.py" "$project_dir" --no-llm --json)

  # 結果を結合
  cat > "$result_file" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "project_dir": "$project_dir",
  "code_grading": $code_result,
  "model_grading": $model_result
}
EOF
}

# === メイン処理 ===

echo "=== Statistical Evaluation Runner ==="
echo "Iterations: $ITERATIONS"
echo "Timeout: $TIMEOUT_SECONDS sec"
echo ""

# 一時作業ディレクトリをクリーンアップ
rm -rf "$WORK_BASE"
mkdir -p "$WORK_BASE"

# タスクリストを決定
if [[ "$RUN_ALL" == "true" ]]; then
  TASKS=("VP-01" "VP-02" "VP-03" "VP-04" "VP-05")
else
  TASKS=("$TASK_ID")
fi

# 結果ディレクトリを作成
RUN_ID="$(timestamp)"
RUN_DIR="$RESULTS_DIR/$RUN_ID"
mkdir -p "$RUN_DIR"

echo "Results will be saved to: $RUN_DIR"
echo ""

# 各タスクを実行
for task in "${TASKS[@]}"; do
  echo "=== Task: $task ==="

  TASK_DIR="$RUN_DIR/$task"
  mkdir -p "$TASK_DIR/with-plugin" "$TASK_DIR/no-plugin"

  prompt="${TASK_PROMPTS[$task]}"
  # Note: 両方のコンディションで同じプロンプトを使用。差異は --plugin-dir の有無のみ
  answers="${TASK_ANSWERS[$task]}"

  echo "Prompt: $prompt"
  echo "(Same prompt for both conditions, diff is --plugin-dir)"
  echo ""

  for i in $(seq 1 "$ITERATIONS"); do
    echo "--- Iteration $i/$ITERATIONS ---"

    # with-plugin モード（--plugin-dir あり = ルール・スキルが読み込まれる）
    echo "[with-plugin] Starting..."
    RESULT_DIR="$TASK_DIR/with-plugin/iter-$i"
    EXEC_DIR="$WORK_BASE/$task/with-plugin/iter-$i"
    mkdir -p "$RESULT_DIR" "$EXEC_DIR"
    init_project_dir "$EXEC_DIR"

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[DRY RUN] Would run: $prompt (with plugin)"
      # ダミーの Plans.md を作成
      echo "# Dummy Plans.md for dry run" > "$EXEC_DIR/Plans.md"
    else
      run_claude_with_print_mode "$EXEC_DIR" "$prompt" "$TIMEOUT_SECONDS" "$EXEC_DIR/claude-output.txt" "true"
    fi

    # 結果をコピー（隠しファイル含む）
    cp -r "$EXEC_DIR"/. "$RESULT_DIR/" 2>/dev/null || true
    run_grading "$RESULT_DIR" "$RESULT_DIR/grading-result.json"
    echo "[with-plugin] Done"

    # no-plugin モード（--plugin-dir なし = 素の Claude）
    echo "[no-plugin] Starting..."
    RESULT_DIR="$TASK_DIR/no-plugin/iter-$i"
    EXEC_DIR="$WORK_BASE/$task/no-plugin/iter-$i"
    mkdir -p "$RESULT_DIR" "$EXEC_DIR"
    init_project_dir "$EXEC_DIR"

    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[DRY RUN] Would run: $prompt (no plugin)"
      # no-plugin では Plans.md を作成しない（素の Claude の挙動をシミュレート）
    else
      run_claude_with_print_mode "$EXEC_DIR" "$prompt" "$TIMEOUT_SECONDS" "$EXEC_DIR/claude-output.txt" "false"
    fi

    # 結果をコピー（隠しファイル含む）
    cp -r "$EXEC_DIR"/. "$RESULT_DIR/" 2>/dev/null || true
    run_grading "$RESULT_DIR" "$RESULT_DIR/grading-result.json"
    echo "[no-plugin] Done"

    echo ""
  done
done

# サマリーを作成
echo "=== Creating Summary ==="
SUMMARY_FILE="$RUN_DIR/summary.json"

cat > "$SUMMARY_FILE" <<EOF
{
  "run_id": "$RUN_ID",
  "iterations": $ITERATIONS,
  "timeout_seconds": $TIMEOUT_SECONDS,
  "tasks": [$(printf '"%s",' "${TASKS[@]}" | sed 's/,$//')],
  "dry_run": $DRY_RUN,
  "results_dir": "$RUN_DIR"
}
EOF

echo "Summary saved to: $SUMMARY_FILE"
echo ""
echo "=== Evaluation Complete ==="
echo ""
echo "Next steps:"
echo "  1. Run statistical analysis:"
echo "     python3 $SCRIPT_DIR/statistical-analysis.py $RUN_DIR"
echo ""
echo "  2. Generate report:"
echo "     python3 $SCRIPT_DIR/statistical-analysis.py $RUN_DIR --report"
