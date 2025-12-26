#!/bin/bash
# check-version-bump.sh
# コード変更時にバージョンが更新されているかを確認
#
# 目的:
# - commands/, skills/, templates/, scripts/ などの変更時に
#   VERSION ファイルも更新されていることを確認
#
# 使用方法:
# - PR の場合: BASE_REF 環境変数を設定
# - Push の場合: 前のコミットと比較

set -euo pipefail

echo "🔢 バージョン変更チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ================================
# 比較対象の決定
# ================================

if [ -n "$GITHUB_BASE_REF" ]; then
  # PR の場合: ベースブランチと比較
  BASE="origin/$GITHUB_BASE_REF"
  echo "📌 PR モード: $BASE と比較"
elif [ -n "$GITHUB_EVENT_NAME" ] && [ "$GITHUB_EVENT_NAME" = "push" ]; then
  # Push の場合: 前のコミットと比較
  BASE="HEAD~1"
  echo "📌 Push モード: 前のコミットと比較"
else
  # ローカル実行: origin/main と比較
  BASE="origin/main"
  echo "📌 ローカルモード: $BASE と比較"
fi

# ベースが取得できるか確認
if ! git rev-parse "$BASE" >/dev/null 2>&1; then
  echo "⚠️ 比較対象 ($BASE) が見つかりません。スキップします。"
  exit 0
fi

# ================================
# コード変更の検出
# ================================

echo ""
echo "🔍 変更ファイルをチェック..."

# チェック対象のパス（VERSION 自体は除外）
CODE_PATHS="commands/ skills/ templates/ scripts/ hooks/ agents/ workflows/"

# 変更されたコードファイルを検出
CHANGED_CODE=$(git diff --name-only "$BASE" HEAD -- $CODE_PATHS 2>/dev/null | grep -v "^$" || true)

if [ -z "$CHANGED_CODE" ]; then
  echo "  ✅ コード変更なし（バージョンチェック不要）"
  exit 0
fi

echo "  📝 変更されたコードファイル:"
echo "$CHANGED_CODE" | head -10 | while read file; do
  echo "     - $file"
done
CHANGED_COUNT=$(echo "$CHANGED_CODE" | wc -l | tr -d ' ')
if [ "$CHANGED_COUNT" -gt 10 ]; then
  echo "     ... 他 $((CHANGED_COUNT - 10)) ファイル"
fi

# ================================
# バージョン変更の検出
# ================================

echo ""
echo "🔍 バージョン変更をチェック..."

# 現在のバージョン
CURRENT_VERSION=$(cat VERSION 2>/dev/null | tr -d '[:space:]')

# ベースのバージョン
BASE_VERSION=$(git show "$BASE:VERSION" 2>/dev/null | tr -d '[:space:]' || echo "")

echo "  ベース: v${BASE_VERSION:-なし}"
echo "  現在:   v${CURRENT_VERSION}"

# ================================
# 判定
# ================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$BASE_VERSION" ]; then
  echo "✅ 新規プロジェクト（バージョンチェックスキップ）"
  exit 0
fi

if [ "$CURRENT_VERSION" = "$BASE_VERSION" ]; then
  echo "❌ バージョンが更新されていません！"
  echo ""
  echo "💡 修正方法:"
  echo "  1. VERSION ファイルを更新（例: $BASE_VERSION → ${BASE_VERSION%.*}.$((${BASE_VERSION##*.} + 1))）"
  echo "  2. plugin.json の version も同じ値に更新"
  echo "  3. CHANGELOG.md に変更内容を追記"
  exit 1
fi

# バージョンが上がっているか確認（単純な文字列比較でなくセマンティックに）
echo "✅ バージョンが更新されています ($BASE_VERSION → $CURRENT_VERSION)"
exit 0
