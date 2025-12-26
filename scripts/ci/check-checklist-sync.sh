#!/bin/bash
# check-checklist-sync.sh
# コマンドファイルのチェックリストとスクリプトの検証項目が同期しているかを確認
#
# 目的:
# - scripts/setup-2agent.sh の check_file/check_dir と
#   commands/setup-2agent.md のチェックリストが一致しているか確認
# - scripts/update-2agent.sh と commands/update-2agent.md も同様

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ERRORS=0

echo "🔍 チェックリスト同期検証"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ================================
# ユーティリティ関数
# ================================

# スクリプトから check_file/check_dir の引数を抽出
extract_script_checks() {
  local script="$1"
  grep -E 'check_(file|dir)' "$script" 2>/dev/null | \
    awk -F'"' '{print $2}' | \
    grep -v '^$' | \
    sort -u
}

# コマンドファイルからチェックリスト項目を抽出
# 「自動検証」セクションのみ抽出（「Claude が生成」セクションは除外）
extract_command_checklist() {
  local cmd="$1"
  # 「自動検証」から「Claude が生成」または次のセクションまでを抽出
  awk '/自動検証/,/Claude が生成|^###|^\*\*全て/' "$cmd" 2>/dev/null | \
    grep -E '^\s*-\s*\[\s*\]\s*`[^`]+`' | \
    awk -F'`' '{print $2}' | \
    grep -v '^$' | \
    sort -u
}

# 2つのリストを比較
compare_lists() {
  local name="$1"
  local script_file="$2"
  local command_file="$3"

  echo ""
  echo "📋 $name の検証..."

  # 一時ファイルに抽出
  local script_checks=$(mktemp)
  local command_checks=$(mktemp)

  extract_script_checks "$script_file" > "$script_checks"
  extract_command_checklist "$command_file" > "$command_checks"

  # スクリプトにあってコマンドにないもの
  local missing_in_command=$(comm -23 "$script_checks" "$command_checks")
  if [ -n "$missing_in_command" ]; then
    echo "  ❌ スクリプトにあるがコマンドのチェックリストにない:"
    echo "$missing_in_command" | while read item; do
      echo "     - $item"
    done
    ERRORS=$((ERRORS + 1))
  fi

  # コマンドにあってスクリプトにないもの
  local missing_in_script=$(comm -13 "$script_checks" "$command_checks")
  if [ -n "$missing_in_script" ]; then
    echo "  ❌ コマンドのチェックリストにあるがスクリプトにない:"
    echo "$missing_in_script" | while read item; do
      echo "     - $item"
    done
    ERRORS=$((ERRORS + 1))
  fi

  if [ -z "$missing_in_command" ] && [ -z "$missing_in_script" ]; then
    local count=$(wc -l < "$script_checks" | tr -d ' ')
    echo "  ✅ 同期済み ($count 項目)"
  fi

  rm -f "$script_checks" "$command_checks"
}

# ================================
# メイン検証
# ================================

# setup-2agent の検証
if [ -f "$PLUGIN_ROOT/scripts/setup-2agent.sh" ] && [ -f "$PLUGIN_ROOT/commands/setup-2agent.md" ]; then
  compare_lists "setup-2agent" \
    "$PLUGIN_ROOT/scripts/setup-2agent.sh" \
    "$PLUGIN_ROOT/commands/setup-2agent.md"
else
  echo "⚠️ setup-2agent のファイルが見つかりません"
fi

# update-2agent の検証
if [ -f "$PLUGIN_ROOT/scripts/update-2agent.sh" ] && [ -f "$PLUGIN_ROOT/commands/update-2agent.md" ]; then
  compare_lists "update-2agent" \
    "$PLUGIN_ROOT/scripts/update-2agent.sh" \
    "$PLUGIN_ROOT/commands/update-2agent.md"
else
  echo "⚠️ update-2agent のファイルが見つかりません"
fi

# ================================
# 結果サマリー
# ================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  echo "✅ チェックリスト同期検証に合格しました"
  exit 0
else
  echo "❌ $ERRORS 個の不整合が見つかりました"
  echo ""
  echo "💡 修正方法:"
  echo "  1. scripts/*.sh の check_file/check_dir を確認"
  echo "  2. commands/*.md のチェックリストを更新"
  echo "  3. 両方が一致するようにする"
  exit 1
fi
