#!/bin/bash
# Check that all commands have description-en field for i18n support

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🌐 Checking i18n translations..."
echo ""

missing_count=0
total_count=0

echo "📁 Commands:"
for file in "$PROJECT_ROOT"/commands/**/*.md; do
  if [[ -f "$file" ]]; then
    total_count=$((total_count + 1))
    relative_path="${file#$PROJECT_ROOT/}"
    if ! grep -q "description-en:" "$file"; then
      echo -e "  ${RED}✗${NC} $relative_path"
      missing_count=$((missing_count + 1))
    else
      echo -e "  ${GREEN}✓${NC} $relative_path"
    fi
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $missing_count -eq 0 ]]; then
  echo -e "${GREEN}✓ All $total_count commands have English translations${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ $missing_count / $total_count commands missing description-en${NC}"
  exit 1
fi
