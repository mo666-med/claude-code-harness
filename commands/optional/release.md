---
description: リリースプロセス自動化（CHANGELOG更新、バージョン更新、タグ作成）
description-en: Automate release process (CHANGELOG update, version bump, tag creation)
---

# /release - リリースプロセス自動化

claude-code-harness のリリースを自動化するコマンドです。

## 実行手順

### Step 1: 変更確認

以下を並列で実行：

1. **git status** で未コミット変更を確認
2. **git diff --stat** で変更ファイル一覧
3. **git log --oneline -10** で最近のコミット履歴

### Step 2: バージョン決定

現在のバージョンを確認：
```bash
cat VERSION
```

変更内容に応じてバージョンを決定（[Semantic Versioning](https://semver.org/spec/v2.0.0.html) 準拠）：
- **patch** (x.y.Z): バグ修正、軽微な改善
- **minor** (x.Y.0): 新機能追加（後方互換あり）
- **major** (X.0.0): 破壊的変更

ユーザーに確認：「次のバージョンは何にしますか？ (例: 2.5.23)」

### Step 3: CHANGELOG.md 更新

**[Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) フォーマットに準拠**

CHANGELOG.md の `## [Unreleased]` の直後に新バージョンのエントリを追加。

#### フォーマット

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- 新機能について

### Changed
- 既存機能の変更について

### Deprecated
- 間もなく削除される機能について

### Removed
- 削除された機能について

### Fixed
- バグ修正について

### Security
- 脆弱性に関する場合

#### Before/After（大きな変更時のみ）

| Before | After |
|--------|-------|
| 変更前の状態 | 変更後の状態 |
```

#### セクション使い分けのルール

| セクション | 使うとき |
|------------|----------|
| Added | 完全に新しい機能を追加したとき |
| Changed | 既存機能の動作や体験を変更したとき |
| Deprecated | 将来削除予定の機能を告知するとき |
| Removed | 機能やコマンドを削除したとき |
| Fixed | バグや不具合を修正したとき |
| Security | セキュリティ関連の修正をしたとき |

#### Before/After テーブル

大きな体験変化があるときのみ追加：
- コマンドの廃止・統合
- ワークフローの変更
- 破壊的変更

軽微な修正では省略可。

#### バージョン比較リンク

CHANGELOG.md 末尾のリンクセクションに追加：

```markdown
[X.Y.Z]: https://github.com/Chachamaru127/claude-code-harness/compare/vPREV...vX.Y.Z
```

既存の `[Unreleased]` リンクも更新：

```markdown
[Unreleased]: https://github.com/Chachamaru127/claude-code-harness/compare/vX.Y.Z...HEAD
```

### Step 4: バージョン更新

```bash
# VERSION ファイル更新
echo "X.Y.Z" > VERSION

# plugin.json 更新
jq '.version = "X.Y.Z"' .claude-plugin/plugin.json > /tmp/plugin.json && mv /tmp/plugin.json .claude-plugin/plugin.json
```

### Step 5: コミット & タグ

```bash
# ステージング
git add VERSION .claude-plugin/plugin.json CHANGELOG.md [変更されたファイル]

# コミット
git commit -m "release: vX.Y.Z - 一言説明

- 変更点1
- 変更点2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# タグ作成
git tag -a vX.Y.Z -m "Release vX.Y.Z: 一言説明"

# プッシュ
git push origin main && git push origin vX.Y.Z
```

### Step 6: キャッシュ同期

```bash
bash scripts/sync-plugin-cache.sh
```

### Step 7: GitHub Releases 作成

タグだけでなく、GitHub Releases にリリースノートを作成します。

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z - 一言説明" \
  --notes "$(cat <<'EOF'
## 🎯 あなたにとって何が変わるか

**主な変更点の説明**

### Before
- 変更前の状態

### After
- 変更後の状態

---

## Added
- 新機能

## Changed
- 変更点

## Fixed
- バグ修正

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**リリースノートの内容**:
- CHANGELOG.md の該当バージョンのエントリをベースに作成
- Before/After セクションは大きな変更時のみ
- `🤖 Generated with [Claude Code]` フッターを追加

### Step 8: 確認

```bash
git log --oneline -3
git tag | tail -5
gh release list --limit 5
cat ~/.claude/plugins/cache/claude-code-harness-marketplace/claude-code-harness/*/VERSION | sort -u
```

## keepachangelog の原則

1. **人間のために書く** - 機械的なコミットログではなく、ユーザーが理解できる言葉で
2. **バージョンごとにまとめる** - 同じ種類の変更をグループ化
3. **最新を先頭に** - 新しいバージョンが上
4. **日付は ISO 8601** - YYYY-MM-DD 形式
5. **Unreleased を活用** - 次リリースまでの変更を蓄積

### Step 3.5: README.md 更新（機能変更時）

新機能追加、コマンド変更、ワークフロー変更がある場合のみ実施：

1. 該当するコマンド/スキルの説明を更新
2. 日本語・英語両方を更新（バイリンガル対応）
3. バージョンバッジを新バージョンに更新

```markdown
# バージョンバッジの更新
[![Version: X.Y.Z](https://img.shields.io/badge/version-X.Y.Z-blue.svg)](VERSION)
```

**更新対象セクション例**:
- 「3行でわかる」 / "In 3 Lines"
- 「これは何？」 / "What is this?"
- 「できること（要点）」 / "What You Can Do"
- 「コマンド」 / "Commands"

## 注意事項

- README.md は機能変更時に更新（バグ修正では不要）
- `skills/test-*` などのテストディレクトリは含めない
- コミットメッセージは Conventional Commits に従う
