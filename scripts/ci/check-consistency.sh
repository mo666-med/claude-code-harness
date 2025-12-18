#!/bin/bash
# check-consistency.sh
# プラグインの整合性チェック
#
# Usage: ./scripts/ci/check-consistency.sh
# Exit codes:
#   0 - All checks passed
#   1 - Inconsistencies found

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ERRORS=0

echo "🔍 claude-code-harness 整合性チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ================================
# 1. テンプレートファイルの存在確認
# ================================
echo ""
echo "📁 [1/5] テンプレートファイルの存在確認..."

REQUIRED_TEMPLATES=(
  "templates/AGENTS.md.template"
  "templates/CLAUDE.md.template"
  "templates/Plans.md.template"
  "templates/.claude-code-harness-version.template"
  "templates/.claude-code-harness.config.yaml.template"
  "templates/cursor/commands/start-session.md"
  "templates/cursor/commands/project-overview.md"
  "templates/cursor/commands/plan-with-cc.md"
  "templates/cursor/commands/handoff-to-claude.md"
  "templates/cursor/commands/review-cc-work.md"
  "templates/claude/settings.security.json.template"
  "templates/rules/workflow.md.template"
  "templates/rules/coding-standards.md.template"
  "templates/rules/plans-management.md.template"
  "templates/rules/testing.md.template"
  "templates/rules/ui-debugging-dev-browser.md.template"
)

for template in "${REQUIRED_TEMPLATES[@]}"; do
  if [ ! -f "$PLUGIN_ROOT/$template" ]; then
    echo "  ❌ 不足: $template"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ $template"
  fi
done

# ================================
# 2. コマンド ↔ スキル の整合性
# ================================
echo ""
echo "🔗 [2/5] コマンド ↔ スキル の参照整合性..."

# コマンドが参照するテンプレートが存在するか
check_command_references() {
  local cmd_file="$1"
  local cmd_name=$(basename "$cmd_file" .md)

  # テンプレートへの参照を抽出
  local refs=$(grep -oE 'templates/[a-zA-Z0-9/_.-]+' "$cmd_file" 2>/dev/null || true)

  for ref in $refs; do
    if [ ! -e "$PLUGIN_ROOT/$ref" ] && [ ! -e "$PLUGIN_ROOT/${ref}.template" ]; then
      echo "  ❌ $cmd_name: 参照先が存在しない: $ref"
      ERRORS=$((ERRORS + 1))
    fi
  done
}

for cmd in "$PLUGIN_ROOT/commands"/*.md; do
  check_command_references "$cmd"
done
echo "  ✅ コマンド参照チェック完了"

# ================================
# 3. バージョン番号の一貫性
# ================================
echo ""
echo "🏷️ [3/5] バージョン番号の一貫性..."

VERSION_FILE="$PLUGIN_ROOT/VERSION"
PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"

if [ -f "$VERSION_FILE" ] && [ -f "$PLUGIN_JSON" ]; then
  FILE_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')
  JSON_VERSION=$(grep '"version"' "$PLUGIN_JSON" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')

  if [ "$FILE_VERSION" != "$JSON_VERSION" ]; then
    echo "  ❌ バージョン不一致: VERSION=$FILE_VERSION, plugin.json=$JSON_VERSION"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ VERSION と plugin.json が一致: $FILE_VERSION"
  fi
fi

# ================================
# 4. スキルの期待ファイル構成
# ================================
echo ""
echo "📋 [4/5] スキル定義の期待ファイル構成..."

# ccp-update-2agent-files の REQUIRED_FILES とテンプレートの同期
UPDATE_SKILL="$PLUGIN_ROOT/skills/core/ccp-update-2agent-files/SKILL.md"
if [ -f "$UPDATE_SKILL" ]; then
  # スキル内の .claude/rules/ 参照を確認
  if ! grep -q "\.claude/rules" "$UPDATE_SKILL"; then
    echo "  ❌ ccp-update-2agent-files に .claude/rules/ の参照がありません"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ ccp-update-2agent-files に rules 参照あり"
  fi
fi

# ================================
# 5. Hooks 設定の整合性
# ================================
echo ""
echo "🪝 [5/5] Hooks 設定の整合性..."

HOOKS_JSON="$PLUGIN_ROOT/hooks/hooks.json"
if [ -f "$HOOKS_JSON" ]; then
  # hooks.json 内のスクリプト参照を確認
  SCRIPT_REFS=$(grep -oE '\$\{CLAUDE_PLUGIN_ROOT\}/scripts/[a-zA-Z0-9_.-]+' "$HOOKS_JSON" 2>/dev/null || true)

  for ref in $SCRIPT_REFS; do
    script_name=$(echo "$ref" | sed 's|\${CLAUDE_PLUGIN_ROOT}/scripts/||')
    if [ ! -f "$PLUGIN_ROOT/scripts/$script_name" ]; then
      echo "  ❌ hooks.json: スクリプトが存在しない: scripts/$script_name"
      ERRORS=$((ERRORS + 1))
    else
      echo "  ✅ scripts/$script_name"
    fi
  done
fi

# ================================
# 6. /start-task 廃止の回帰チェック
# ================================
echo ""
echo "🚫 [6/7] /start-task 廃止の回帰チェック..."

# 運用導線ファイル（CHANGELOG等の履歴は除外）
START_TASK_TARGETS=(
  "commands/"
  "skills/"
  "workflows/"
  "profiles/"
  "templates/"
  "scripts/"
  "DEVELOPMENT_FLOW_GUIDE.md"
  "IMPLEMENTATION_GUIDE.md"
  "README.md"
)

START_TASK_FOUND=0
for target in "${START_TASK_TARGETS[@]}"; do
  if [ -e "$PLUGIN_ROOT/$target" ]; then
    # /start-task への参照を検索（履歴・説明文脈は除外）
    # 除外パターン: 削除/廃止/Removed（履歴）, 相当/統合/従来/吸収（移行説明）, 改善/使い分け（CHANGELOG）
    REFS=$(grep -rn "/start-task" "$PLUGIN_ROOT/$target" 2>/dev/null \
      | grep -v "削除" | grep -v "廃止" | grep -v "Removed" \
      | grep -v "相当" | grep -v "統合" | grep -v "従来" | grep -v "吸収" \
      | grep -v "改善" | grep -v "使い分け" | grep -v "CHANGELOG" \
      | grep -v "check-consistency.sh" \
      || true)
    if [ -n "$REFS" ]; then
      echo "  ❌ /start-task 参照が残存: $target"
      echo "$REFS" | head -3 | sed 's/^/      /'
      START_TASK_FOUND=$((START_TASK_FOUND + 1))
    fi
  fi
done

if [ $START_TASK_FOUND -eq 0 ]; then
  echo "  ✅ /start-task 参照なし（運用導線）"
else
  ERRORS=$((ERRORS + START_TASK_FOUND))
fi

# ================================
# 7. docs/ 正規化の回帰チェック
# ================================
echo ""
echo "📁 [7/7] docs/ 正規化の回帰チェック..."

# proposal.md / priority_matrix.md のルート参照をチェック
DOCS_TARGETS=(
  "commands/"
  "skills/"
)

DOCS_ISSUES=0
for target in "${DOCS_TARGETS[@]}"; do
  if [ -d "$PLUGIN_ROOT/$target" ]; then
    # ルート直下の proposal.md / technical-spec.md / priority_matrix.md への参照を検索
    # docs/ プレフィックスがないものを検出
    REFS=$(grep -rn "proposal.md\|technical-spec.md\|priority_matrix.md" "$PLUGIN_ROOT/$target" 2>/dev/null | grep -v "docs/" | grep -v "\.template" || true)
    if [ -n "$REFS" ]; then
      echo "  ❌ docs/ プレフィックスなしの参照: $target"
      echo "$REFS" | head -3 | sed 's/^/      /'
      DOCS_ISSUES=$((DOCS_ISSUES + 1))
    fi
  fi
done

if [ $DOCS_ISSUES -eq 0 ]; then
  echo "  ✅ docs/ 正規化OK"
else
  ERRORS=$((ERRORS + DOCS_ISSUES))
fi

# ================================
# 結果サマリー
# ================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  echo "✅ すべてのチェックに合格しました"
  exit 0
else
  echo "❌ $ERRORS 個の問題が見つかりました"
  exit 1
fi
