#!/bin/bash
# migrate-plans-format.sh
# Plans.md の旧フォーマットマーカーを新フォーマットに自動変換
#
# 変換ルール:
#   cursor:WIP    → cc:WIP
#   cursor:完了   → cc:完了
#   cursor:依頼中 → pm:依頼中  (既に対応済みだが念のため)
#   cursor:確認済 → pm:確認済  (既に対応済みだが念のため)
#
# Usage:
#   ./migrate-plans-format.sh [Plans.md のパス]
#   デフォルト: カレントディレクトリの Plans.md

set -euo pipefail

# Plans.md のパス（引数で指定可能）
PLANS_FILE="${1:-Plans.md}"

# ファイル存在チェック
if [ ! -f "$PLANS_FILE" ]; then
  echo "Plans.md が見つかりません: $PLANS_FILE"
  exit 0
fi

# 旧フォーマットの検出
detect_old_format() {
  grep -cE "cursor:(WIP|完了)" "$PLANS_FILE" 2>/dev/null || echo "0"
}

OLD_COUNT=$(detect_old_format)

if [ "$OLD_COUNT" = "0" ]; then
  echo "✅ Plans.md は既に新フォーマットです。変換不要。"
  exit 0
fi

echo "🔄 旧フォーマットを検出: ${OLD_COUNT} 箇所"
echo ""

# バックアップ作成
BACKUP_FILE="${PLANS_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$PLANS_FILE" "$BACKUP_FILE"
echo "📁 バックアップ作成: $BACKUP_FILE"

# 変換実行
# macOS と Linux 両対応の sed
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' 's/cursor:WIP/cc:WIP/g' "$PLANS_FILE"
  sed -i '' 's/cursor:完了/cc:完了/g' "$PLANS_FILE"
else
  # Linux
  sed -i 's/cursor:WIP/cc:WIP/g' "$PLANS_FILE"
  sed -i 's/cursor:完了/cc:完了/g' "$PLANS_FILE"
fi

# 変換結果確認
NEW_OLD_COUNT=$(detect_old_format)

if [ "$NEW_OLD_COUNT" = "0" ]; then
  echo ""
  echo "✅ 変換完了！"
  echo ""
  echo "変換内容:"
  echo "  cursor:WIP  → cc:WIP"
  echo "  cursor:完了 → cc:完了"
  echo ""
  echo "バックアップは不要になったら削除してください: $BACKUP_FILE"
else
  echo ""
  echo "⚠️ 一部変換できませんでした（残り: ${NEW_OLD_COUNT} 箇所）"
  echo "手動で確認してください。"
fi
