#!/bin/bash
# tdd-order-check.sh
# TDD 推奨タスクでテスト先行を推奨する警告を出す（ブロックはしない）
#
# 用途: PostToolUse で Write|Edit 後に実行
# 動作:
#   - Plans.md に [feature:tdd] マーカーがあるタスクが cc:WIP の場合
#   - 本体ファイル（*.ts, *.tsx, *.js, *.jsx）が編集された
#   - 対応するテストファイル（*.test.*, *.spec.*）がまだ編集されていない
#   → 警告メッセージを出力（ブロックはしない）

set -euo pipefail

# 編集されたファイル情報を取得
TOOL_INPUT="${TOOL_INPUT:-}"
FILE_PATH=""

# TOOL_INPUT から file_path を抽出（macOS/Linux 両対応）
if [[ -n "$TOOL_INPUT" ]]; then
    # jq が利用可能な場合は jq を使用（最も安全）
    if command -v jq &>/dev/null; then
        FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null || true)
    else
        # フォールバック: sed で抽出（POSIX 互換）
        FILE_PATH=$(echo "$TOOL_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null || true)
    fi
fi

# ファイルパスがなければ終了
if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# テストファイルかどうかをチェック
is_test_file() {
    local file="$1"
    [[ "$file" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] || \
    [[ "$file" =~ __tests__/ ]] || \
    [[ "$file" =~ /tests?/ ]]
}

# ソースファイルかどうかをチェック（テストファイルを除く）
is_source_file() {
    local file="$1"
    [[ "$file" =~ \.(ts|tsx|js|jsx)$ ]] && ! is_test_file "$file"
}

# TDD 推奨タスクが WIP かチェック
has_tdd_wip_task() {
    if [[ -f "Plans.md" ]]; then
        grep -q '\[feature:tdd\].*cc:WIP\|cc:WIP.*\[feature:tdd\]' Plans.md 2>/dev/null
        return $?
    fi
    return 1
}

# セッション中にテストファイルが編集されたかチェック（簡易版）
test_edited_this_session() {
    # .claude/state/session-changes.json があればチェック
    local state_file=".claude/state/session-changes.json"
    if [[ -f "$state_file" ]]; then
        grep -q '\.test\.\|\.spec\.\|__tests__' "$state_file" 2>/dev/null
        return $?
    fi
    return 1
}

# メイン処理
main() {
    # ソースファイルでなければスキップ
    if ! is_source_file "$FILE_PATH"; then
        exit 0
    fi

    # テストファイルならスキップ
    if is_test_file "$FILE_PATH"; then
        exit 0
    fi

    # TDD 推奨タスクが WIP でなければスキップ
    if ! has_tdd_wip_task; then
        exit 0
    fi

    # テストファイルが既に編集されていればスキップ
    if test_edited_this_session; then
        exit 0
    fi

    # 警告を出力（ブロックはしない）
    cat << 'EOF'
{
  "decision": "approve",
  "reason": "TDD reminder",
  "systemMessage": "💡 TDD 推奨タスクです。テストを先に書くことを推奨します。\n\n現在、本体ファイルを編集しましたが、対応するテストファイルがまだ編集されていません。\n\n推奨: テストファイル（*.test.ts, *.spec.ts）を先に作成してから、本体を実装してください。\n\nこれは警告であり、ブロックはしません。"
}
EOF
}

main
