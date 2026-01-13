#!/bin/bash
# ======================================
# ローカルテスト環境（Tmux）
# ======================================
#
# Usage:
#   ./local-test.sh [--task TASK] [--mode MODE] [--watch]
#
# Examples:
#   ./local-test.sh --task plan-feature --mode with-plugin
#   ./local-test.sh --task plan-feature --mode with-plugin --watch
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCHMARK_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_ROOT="$(dirname "$BENCHMARK_DIR")"
TEST_PROJECT="$BENCHMARK_DIR/test-project"
RESULTS_DIR="$BENCHMARK_DIR/results"

# デフォルト設定
TASK="plan-feature"
MODE="with-plugin"
WATCH_MODE=false
SESSION_NAME="bench-test"

# ヘルプ
show_help() {
  cat << EOF
ローカルベンチマークテスト（Tmux）

Usage: $0 [OPTIONS]

OPTIONS:
  --task <name>     テストするタスク（デフォルト: plan-feature）
  --mode <mode>     with-plugin または no-plugin（デフォルト: with-plugin）
  --watch           Tmux セッションを作成してモニタリング
  --attach          既存セッションにアタッチ
  --kill            セッションを終了
  --help            このヘルプを表示

EXAMPLES:
  # シンプル実行（結果を stdout に）
  $0 --task plan-feature --mode with-plugin

  # Tmux でモニタリング（3ペイン: 実行/プロジェクト/ログ）
  $0 --task plan-feature --mode with-plugin --watch

  # セッションにアタッチ
  $0 --attach

  # セッション終了
  $0 --kill
EOF
}

# 引数解析
while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK="$2"
      shift 2
      ;;
    --mode)
      MODE="$2"
      shift 2
      ;;
    --watch)
      WATCH_MODE=true
      shift
      ;;
    --attach)
      tmux attach-session -t "$SESSION_NAME" 2>/dev/null || echo "セッションが存在しません: $SESSION_NAME"
      exit 0
      ;;
    --kill)
      tmux kill-session -t "$SESSION_NAME" 2>/dev/null || echo "セッションが存在しません: $SESSION_NAME"
      echo "セッション終了: $SESSION_NAME"
      exit 0
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

# テストプロジェクトをセットアップ
setup_test_project() {
  echo "📁 テストプロジェクトをセットアップ..."
  bash "$SCRIPT_DIR/setup-test-project.sh" > /dev/null 2>&1
  echo "   → $TEST_PROJECT"
}

# シンプル実行
run_simple() {
  setup_test_project

  echo ""
  echo "========================================"
  echo "🧪 ローカルテスト実行"
  echo "========================================"
  echo "Task: $TASK"
  echo "Mode: $MODE"
  echo "========================================"
  echo ""

  local with_plugin_flag=""
  if [[ "$MODE" == "with-plugin" ]]; then
    with_plugin_flag="--with-plugin"
  fi

  # 実行（ローカルは既存セッションを使用）
  bash "$SCRIPT_DIR/run-workflow-benchmark.sh" \
    --task "$TASK" \
    $with_plugin_flag \
    --no-temp-home \
    --iteration 1

  echo ""
  echo "========================================"
  echo "📊 結果ファイル:"
  ls -la "$RESULTS_DIR"/${TASK}_* 2>/dev/null | tail -5
  echo "========================================"
}

# Tmux モニタリング実行
run_with_tmux() {
  # 既存セッションを確認
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "既存セッションが見つかりました。アタッチします..."
    tmux attach-session -t "$SESSION_NAME"
    exit 0
  fi

  setup_test_project

  echo "🖥️  Tmux セッションを作成: $SESSION_NAME"

  # セッション作成（3ペイン構成）
  tmux new-session -d -s "$SESSION_NAME" -c "$BENCHMARK_DIR"

  # ペイン0: ベンチマーク実行
  tmux send-keys -t "$SESSION_NAME:0" "echo '=== ベンチマーク実行ペイン ===' && cd $BENCHMARK_DIR" C-m

  # ペイン1: テストプロジェクト監視
  tmux split-window -h -t "$SESSION_NAME:0" -c "$TEST_PROJECT"
  tmux send-keys -t "$SESSION_NAME:0.1" "echo '=== テストプロジェクト監視 ===' && watch -n 2 'ls -la; echo; cat Plans.md 2>/dev/null | head -30'" C-m

  # ペイン2: 結果監視
  tmux split-window -v -t "$SESSION_NAME:0.0" -c "$RESULTS_DIR"
  tmux send-keys -t "$SESSION_NAME:0.2" "echo '=== 結果ファイル監視 ===' && watch -n 2 'ls -lt | head -10'" C-m

  # ペイン0 にベンチマークコマンドを入力
  local with_plugin_flag=""
  if [[ "$MODE" == "with-plugin" ]]; then
    with_plugin_flag="--with-plugin"
  fi

  tmux select-pane -t "$SESSION_NAME:0.0"
  tmux send-keys -t "$SESSION_NAME:0.0" "# ベンチマーク実行コマンド（Enter で実行）:" C-m
  tmux send-keys -t "$SESSION_NAME:0.0" "bash scripts/run-workflow-benchmark.sh --task $TASK $with_plugin_flag --no-temp-home --iteration 1"

  echo ""
  echo "========================================"
  echo "Tmux セッション構成:"
  echo "  左上: ベンチマーク実行（Enter で開始）"
  echo "  右:   テストプロジェクト監視"
  echo "  左下: 結果ファイル監視"
  echo ""
  echo "操作:"
  echo "  Ctrl+b → 矢印キー: ペイン移動"
  echo "  Ctrl+b → d: デタッチ"
  echo "  $0 --attach: 再アタッチ"
  echo "  $0 --kill: セッション終了"
  echo "========================================"
  echo ""

  # アタッチ
  tmux attach-session -t "$SESSION_NAME"
}

# メイン
if [[ "$WATCH_MODE" == "true" ]]; then
  run_with_tmux
else
  run_simple
fi
