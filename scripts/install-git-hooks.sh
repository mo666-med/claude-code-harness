#!/usr/bin/env bash
#
# install-git-hooks.sh
# Repo-managed git hooks installer (uses core.hooksPath).
#
# Usage:
#   ./scripts/install-git-hooks.sh
#

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "❌ git リポジトリではありません"
  exit 1
fi

cd "$ROOT"

if [ ! -d ".githooks" ]; then
  echo "❌ .githooks/ が見つかりません"
  exit 1
fi

chmod +x .githooks/pre-commit 2>/dev/null || true

git config core.hooksPath .githooks

echo "✅ Git hooks を有効化しました: core.hooksPath=.githooks"
echo "   - pre-commit: 変更があるのに VERSION 未更新なら自動パッチバンプしてステージします"


