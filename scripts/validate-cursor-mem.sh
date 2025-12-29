#!/bin/bash

# Cursor × Claude-mem Setup Validation Script
# 使用例: ./scripts/validate-cursor-mem.sh

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 検証結果カウンター
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# チェック結果を記録
function check_result() {
  local status=$1
  local message=$2

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  case "$status" in
    pass)
      echo -e "${GREEN}✅ $message${NC}"
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
      ;;
    fail)
      echo -e "${RED}❌ $message${NC}"
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
      ;;
    warn)
      echo -e "${YELLOW}⚠️  $message${NC}"
      WARNING_CHECKS=$((WARNING_CHECKS + 1))
      ;;
  esac
}

echo -e "${CYAN}🔍 Cursor × Claude-mem セットアップ検証を開始...${NC}"
echo ""

# ========================================
# Phase 1: Worker 起動確認
# ========================================
echo -e "${BLUE}【Phase 1】Worker 起動確認${NC}"

WORKER_PORT="${CLAUDE_MEM_WORKER_PORT:-37777}"
WORKER_HOST="${CLAUDE_MEM_WORKER_HOST:-127.0.0.1}"

if curl -s "http://${WORKER_HOST}:${WORKER_PORT}/health" > /dev/null 2>&1; then
  HEALTH_RESPONSE=$(curl -s "http://${WORKER_HOST}:${WORKER_PORT}/health")
  if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    check_result pass "Worker が正常に起動しています (${WORKER_HOST}:${WORKER_PORT})"
  else
    check_result fail "Worker の応答が異常です: $HEALTH_RESPONSE"
  fi
else
  check_result fail "Worker が起動していません (${WORKER_HOST}:${WORKER_PORT})"
  echo "  起動コマンド: claude-mem restart"
fi
echo ""

# ========================================
# Phase 2: MCP 設定確認
# ========================================
echo -e "${BLUE}【Phase 2】MCP 設定確認${NC}"

GLOBAL_MCP="$HOME/.cursor/mcp.json"
LOCAL_MCP=".cursor/mcp.json"

MCP_FOUND=false

# グローバル設定チェック
if [ -f "$GLOBAL_MCP" ]; then
  if grep -q "claude-mem" "$GLOBAL_MCP" 2>/dev/null; then
    check_result pass "グローバル MCP 設定を検出 (~/.cursor/mcp.json)"
    MCP_FOUND=true

    # 設定内容の検証
    if grep -q '"type".*"stdio"' "$GLOBAL_MCP" && \
       grep -q '"command"' "$GLOBAL_MCP"; then
      check_result pass "MCP 設定の構造が正しい"
    else
      check_result warn "MCP 設定の構造に問題がある可能性"
    fi
  fi
else
  check_result warn "グローバル MCP 設定ファイルが存在しません"
fi

# ローカル設定チェック
if [ -f "$LOCAL_MCP" ]; then
  if grep -q "claude-mem" "$LOCAL_MCP" 2>/dev/null; then
    check_result pass "プロジェクトローカル MCP 設定を検出 (.cursor/mcp.json)"
    MCP_FOUND=true

    # 設定内容の検証
    if grep -q '"type".*"stdio"' "$LOCAL_MCP" && \
       grep -q '"command"' "$LOCAL_MCP"; then
      check_result pass "MCP 設定の構造が正しい"
    else
      check_result warn "MCP 設定の構造に問題がある可能性"
    fi
  fi
else
  check_result warn "プロジェクトローカル MCP 設定ファイルが存在しません"
fi

if [ "$MCP_FOUND" = false ]; then
  check_result fail "MCP 設定が見つかりません"
  echo "  セットアップコマンド: /cursor-mem"
fi
echo ""

# ========================================
# Phase 3: フックスクリプト確認
# ========================================
echo -e "${BLUE}【Phase 3】フックスクリプト確認${NC}"

REQUIRED_SCRIPTS=(
  "scripts/cursor-hooks/utils.js"
  "scripts/cursor-hooks/record-prompt.js"
  "scripts/cursor-hooks/record-edit.js"
  "scripts/cursor-hooks/record-stop.js"
  "scripts/cursor-hooks/run-hook.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    check_result pass "スクリプト存在: $script"

    # 実行権限チェック (.sh ファイルのみ)
    if [[ "$script" == *.sh ]]; then
      if [ -x "$script" ]; then
        check_result pass "実行権限あり: $script"
      else
        check_result warn "実行権限なし: $script (chmod +x $script)"
      fi
    fi
  else
    check_result fail "スクリプト不在: $script"
  fi
done
echo ""

# ========================================
# Phase 4: Hooks 設定確認
# ========================================
echo -e "${BLUE}【Phase 4】Hooks 設定確認${NC}"

if [ -f ".cursor/hooks.json" ]; then
  check_result pass "hooks.json が存在します"

  # 設定内容の検証
  if grep -q "beforeSubmitPrompt" ".cursor/hooks.json" && \
     grep -q "afterFileEdit" ".cursor/hooks.json" && \
     grep -q "stop" ".cursor/hooks.json"; then
    check_result pass "必要なフックが定義されています"
  else
    check_result warn "フック定義が不完全です"
  fi

  # コマンドパスの検証
  if grep -q "scripts/cursor-hooks/" ".cursor/hooks.json"; then
    check_result pass "スクリプトパスが正しい"
  else
    check_result fail "スクリプトパスに問題があります"
  fi
else
  check_result fail "hooks.json が存在しません"
  echo "  セットアップコマンド: /cursor-mem"
fi

if [ -f ".cursor/hooks.json.example" ]; then
  check_result pass "hooks.json.example が存在します"
else
  check_result warn "hooks.json.example が存在しません"
fi
echo ""

# ========================================
# Phase 5: .cursorrules 確認
# ========================================
echo -e "${BLUE}【Phase 5】.cursorrules 確認${NC}"

if [ -f ".cursorrules" ]; then
  check_result pass ".cursorrules が存在します"
else
  check_result warn ".cursorrules が存在しません（オプション）"
fi

if [ -f ".cursorrules.example" ]; then
  check_result pass ".cursorrules.example が存在します"
else
  check_result warn ".cursorrules.example が存在しません"
fi
echo ""

# ========================================
# Phase 6: データベース確認
# ========================================
echo -e "${BLUE}【Phase 6】Claude-mem データベース確認${NC}"

DB_PATH="${CLAUDE_MEM_DB:-$HOME/.claude-mem/claude-mem.db}"

if [ -f "$DB_PATH" ]; then
  check_result pass "データベースが存在します ($DB_PATH)"

  # テーブル存在確認
  if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='sdk_sessions';" | grep -q "sdk_sessions"; then
    check_result pass "sdk_sessions テーブルが存在します"
  else
    check_result fail "sdk_sessions テーブルが存在しません"
  fi

  if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='user_prompts';" | grep -q "user_prompts"; then
    check_result pass "user_prompts テーブルが存在します"
  else
    check_result fail "user_prompts テーブルが存在しません"
  fi

  if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='observations';" | grep -q "observations"; then
    check_result pass "observations テーブルが存在します"
  else
    check_result fail "observations テーブルが存在しません"
  fi

  # 記録数の確認
  TOTAL_RECORDS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM observations;" 2>/dev/null || echo "0")
  if [ "$TOTAL_RECORDS" -gt 0 ]; then
    check_result pass "記録があります ($TOTAL_RECORDS 件)"
  else
    check_result warn "記録がまだありません (Cursor でプロンプトを送信してください)"
  fi
else
  check_result fail "データベースが存在しません ($DB_PATH)"
  echo "  初期化コマンド: claude-mem install"
fi
echo ""

# ========================================
# Phase 7: ドキュメント確認
# ========================================
echo -e "${BLUE}【Phase 7】ドキュメント確認${NC}"

if [ -f "docs/guides/cursor-mem-integration.md" ]; then
  check_result pass "統合ガイドが存在します"
else
  check_result warn "統合ガイドが存在しません"
fi

if [ -f "commands/optional/cursor-mem.md" ]; then
  check_result pass "コマンドドキュメントが存在します"
else
  check_result fail "コマンドドキュメントが存在しません"
fi
echo ""

# ========================================
# 検証結果サマリー
# ========================================
echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}検証結果サマリー${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "総チェック数: ${TOTAL_CHECKS}"
echo -e "${GREEN}✅ 成功: ${PASSED_CHECKS}${NC}"
echo -e "${YELLOW}⚠️  警告: ${WARNING_CHECKS}${NC}"
echo -e "${RED}❌ 失敗: ${FAILED_CHECKS}${NC}"
echo ""

# 終了ステータス
if [ "$FAILED_CHECKS" -gt 0 ]; then
  echo -e "${RED}❌ セットアップに問題があります${NC}"
  echo ""
  echo "修正方法:"
  echo "  1. Worker が起動していない → claude-mem restart"
  echo "  2. MCP 設定がない → /cursor-mem コマンドを実行"
  echo "  3. hooks.json がない → /cursor-mem コマンドを実行"
  echo "  4. スクリプトがない → プラグインを再インストール"
  echo ""
  exit 1
elif [ "$WARNING_CHECKS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  セットアップは動作しますが、いくつか警告があります${NC}"
  echo ""
  echo "推奨事項:"
  echo "  - .cursorrules を作成すると、セッション開始時に自動でメモリを検索します"
  echo "  - Cursor でプロンプトを送信して、記録が保存されるか確認してください"
  echo ""
  exit 0
else
  echo -e "${GREEN}✅ セットアップは完璧です！${NC}"
  echo ""
  echo "次のステップ:"
  echo "  1. Cursor を再起動してください"
  echo "  2. Cursor でプロンプトを送信してみてください"
  echo "  3. 記録を確認: ./tests/cursor-mem/verify-records.sh --recent"
  echo ""
  exit 0
fi
