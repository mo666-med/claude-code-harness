#!/bin/bash
# setup-existing-project.sh
# 既存プロジェクトにclaude-code-harnessを適用するセットアップスクリプト
#
# Usage: ./scripts/setup-existing-project.sh [project_path]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_PATH="${1:-.}"

# カラー出力
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Claude Code Harness - 既存プロジェクト適用${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ================================
# Step 1: 前提条件チェック
# ================================

echo -e "${BLUE}[1/6] 前提条件チェック${NC}"
echo "----------------------------------------"

# プロジェクトディレクトリの存在確認
if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${RED}✗ プロジェクトディレクトリが見つかりません: $PROJECT_PATH${NC}"
    exit 1
fi

cd "$PROJECT_PATH"
PROJECT_PATH=$(pwd)
echo -e "${GREEN}✓${NC} プロジェクトディレクトリ: $PROJECT_PATH"

# Gitリポジトリかチェック
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠${NC}  Gitリポジトリではありません"
    read -p "Gitリポジトリを初期化しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git init
        echo -e "${GREEN}✓${NC} Gitリポジトリを初期化しました"
    fi
else
    echo -e "${GREEN}✓${NC} Gitリポジトリです"
fi

# 未コミットの変更をチェック
if [ -d ".git" ]; then
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "${YELLOW}⚠${NC}  未コミットの変更があります"
        echo ""
        echo -e "${YELLOW}推奨: セットアップ前にコミットしてください${NC}"
        echo ""
        read -p "続行しますか？ (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "セットアップを中止しました"
            exit 0
        fi
    else
        echo -e "${GREEN}✓${NC} 作業ツリーはクリーンです"
    fi
fi

echo ""

# ================================
# Step 2: 既存の仕様書・ドキュメント探索
# ================================

echo -e "${BLUE}[2/6] 既存ドキュメントの探索${NC}"
echo "----------------------------------------"

FOUND_DOCS=()
DOC_PATTERNS=(
    "README.md"
    "SPEC.md"
    "SPECIFICATION.md"
    "仕様書.md"
    "要件定義.md"
    "docs/spec.md"
    "docs/specification.md"
    "docs/requirements.md"
    "docs/proposal.md"
    "docs/提案書.md"
    "Plans.md"
    "PLAN.md"
    "計画.md"
)

for pattern in "${DOC_PATTERNS[@]}"; do
    if [ -f "$pattern" ]; then
        FOUND_DOCS+=("$pattern")
        echo -e "${GREEN}✓${NC} 発見: $pattern"
    fi
done

if [ ${#FOUND_DOCS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠${NC}  既存の仕様書が見つかりませんでした"
else
    echo ""
    echo -e "${GREEN}${#FOUND_DOCS[@]} 個のドキュメントを発見しました${NC}"
fi

echo ""

# ================================
# Step 3: プロジェクト分析
# ================================

echo -e "${BLUE}[3/6] プロジェクト分析${NC}"
echo "----------------------------------------"

# analyze-project.shを実行
if [ -f "$HARNESS_ROOT/scripts/analyze-project.sh" ]; then
    ANALYSIS_RESULT=$("$HARNESS_ROOT/scripts/analyze-project.sh" "$PROJECT_PATH" 2>/dev/null || echo "{}")
    
    # 技術スタック表示
    if command -v jq &> /dev/null; then
        TECH_STACK=$(echo "$ANALYSIS_RESULT" | jq -r '.tech_stack[]' 2>/dev/null || echo "")
        if [ -n "$TECH_STACK" ]; then
            echo "検出された技術スタック:"
            echo "$TECH_STACK" | while read -r tech; do
                echo -e "  ${GREEN}•${NC} $tech"
            done
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC}  プロジェクト分析スクリプトが見つかりません"
fi

echo ""

# ================================
# Step 4: ハーネス設定ファイルの作成
# ================================

echo -e "${BLUE}[4/6] ハーネス設定ファイルの作成${NC}"
echo "----------------------------------------"

# .claude-code-harness ディレクトリを作成
mkdir -p .claude-code-harness

# 既存ドキュメントへの参照を含む設定ファイルを作成
cat > .claude-code-harness/config.json << EOF
{
  "version": "2.0.0",
  "setup_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project_type": "existing",
  "existing_documents": [
$(
    for doc in "${FOUND_DOCS[@]}"; do
        echo "    \"$doc\","
    done | sed '$ s/,$//'
)
  ],
  "harness_path": "$HARNESS_ROOT"
}
EOF

echo -e "${GREEN}✓${NC} 設定ファイルを作成: .claude-code-harness/config.json"

# 既存ドキュメントのサマリーを作成
if [ ${#FOUND_DOCS[@]} -gt 0 ]; then
    cat > .claude-code-harness/existing-docs-summary.md << EOF
# 既存ドキュメント一覧

このプロジェクトには以下の既存ドキュメントがあります：

EOF

    for doc in "${FOUND_DOCS[@]}"; do
        echo "## $doc" >> .claude-code-harness/existing-docs-summary.md
        echo "" >> .claude-code-harness/existing-docs-summary.md
        echo '```' >> .claude-code-harness/existing-docs-summary.md
        head -20 "$doc" >> .claude-code-harness/existing-docs-summary.md
        echo '```' >> .claude-code-harness/existing-docs-summary.md
        echo "" >> .claude-code-harness/existing-docs-summary.md
    done
    
    echo -e "${GREEN}✓${NC} 既存ドキュメントサマリーを作成: .claude-code-harness/existing-docs-summary.md"
fi

echo ""

# ================================
# Step 5: Project Rulesの作成
# ================================

echo -e "${BLUE}[5/6] Project Rulesの作成${NC}"
echo "----------------------------------------"

# .claude/rules ディレクトリを作成
mkdir -p .claude/rules

# 既存プロジェクト向けのProject Rulesを作成
cat > .claude/rules/harness.md << 'EOF'
# Claude Code Harness - Project Rules

このプロジェクトは **claude-code-harness** を使用しています。

## 既存プロジェクトへの適用

このプロジェクトは既存のコードベースに claude-code-harness を適用したものです。

### 既存の資産を尊重する

1. **既存のドキュメントを優先**
   - 既存の仕様書、README、計画書がある場合は、それらを最優先で参照する
   - `.claude-code-harness/existing-docs-summary.md` に既存ドキュメントの一覧がある

2. **既存のコードスタイルを維持**
   - 既存のコーディング規約、フォーマット設定を尊重する
   - 新規コードは既存コードのスタイルに合わせる

3. **段階的な改善**
   - 一度に全てを書き換えない
   - 既存の動作を壊さないよう注意する

## 利用可能なコマンド

### 計画・仕様
- `/plan` - プロジェクト計画の作成・更新（既存ドキュメントを考慮）

### 実装
- `/work` - 機能実装（既存コードとの整合性を保つ）
- `/component` - UIコンポーネント実装
- `/crud` - CRUD機能生成
- `/auth` - 認証実装
- `/payments` - 決済統合

### 品質保証
- `/review` - コードレビュー
- `/auto-fix` - 自動修正
- `/validate` - 納品前検証

### デプロイ
- `/ci-setup` - CI/CD設定
- `/deploy-setup` - デプロイ設定

### 運用
- `/analytics` - アナリティクス統合
- `/feedback` - フィードバック機能

## 既存プロジェクトでの注意点

1. **既存の仕様書を必ず確認**
   - コマンド実行前に既存ドキュメントを読む
   - 矛盾がある場合は確認する

2. **段階的な適用**
   - 小さな機能から始める
   - 動作確認を頻繁に行う

3. **バージョン管理**
   - こまめにコミットする
   - 大きな変更前にブランチを切る

## セットアップ情報

- セットアップ日: $(date +"%Y-%m-%d")
- ハーネスバージョン: 2.0.0
- 設定ファイル: `.claude-code-harness/config.json`
EOF

echo -e "${GREEN}✓${NC} Project Rulesを作成: .claude/rules/harness.md"

echo ""

# ================================
# Step 6: セットアップ完了
# ================================

echo -e "${BLUE}[6/6] セットアップ完了${NC}"
echo "----------------------------------------"

echo ""
echo -e "${GREEN}✅ セットアップが完了しました！${NC}"
echo ""
echo "次のステップ:"
echo ""
echo "1. 既存ドキュメントを確認:"
echo -e "   ${BLUE}cat .claude-code-harness/existing-docs-summary.md${NC}"
echo ""
echo "2. Claude Codeでプロジェクトを開く:"
echo -e "   ${BLUE}cd $PROJECT_PATH${NC}"
echo -e "   ${BLUE}claude --plugin-dir $HARNESS_ROOT${NC}"
echo ""
echo "3. 既存の仕様を確認してから計画を更新:"
echo -e "   ${BLUE}/plan${NC}"
echo ""
echo "4. 小さな機能から実装を開始:"
echo -e "   ${BLUE}/work${NC}"
echo ""

# .gitignoreに追加
if [ -f ".gitignore" ]; then
    if ! grep -q ".claude-code-harness" .gitignore; then
        echo "" >> .gitignore
        echo "# Claude Code Harness" >> .gitignore
        echo ".claude-code-harness/" >> .gitignore
        echo -e "${GREEN}✓${NC} .gitignoreに追加しました"
    fi
fi

echo ""
echo -e "${YELLOW}⚠${NC}  重要: 変更をコミットすることを推奨します"
echo ""
