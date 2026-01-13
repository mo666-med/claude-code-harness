# Optional Plugins

このリポジトリ（`claude-code-harness`）本体は、機能追加を「同梱」ではなく **任意の外部ツール導入**として扱えるようにしています。

---

## Agent Browser（推奨: UIデバッグ/検証）

`agent-browser` は、Claude Code から **ブラウザ操作を行い、画面で検証してループを閉じる**ための CLI ツールです。

- **向いている用途**: UIの不具合調査、クリック/フォーム/遷移などのクリティカルパス検証、見た目の微調整の反復
- **特徴**: AI エージェント向けに最適化（`snapshot` コマンドで要素参照 `@e1`, `@e2` を取得可能）
- **本体に同梱しない理由**: ブラウザ実行環境が必要であり、全員に強制すると運用コストが増えるため

参照: `https://github.com/vercel-labs/agent-browser`

### 前提条件

- Node.js / npm がインストール済み
- macOS / Linux / Windows 対応

### インストール

```bash
# グローバルインストール
npm install -g agent-browser

# Chromium をダウンロード
agent-browser install
```

### 基本的な使い方

```bash
# ページを開く
agent-browser open https://example.com

# AI 向けスナップショット（要素参照付き）
agent-browser snapshot -i -c

# 要素をクリック（参照を使用）
agent-browser click @e1

# フォームに入力
agent-browser fill @e2 "text"

# スクリーンショット取得
agent-browser screenshot output.png

# ブラウザを表示して操作（デバッグ用）
agent-browser --headed open https://example.com
```

### 主要コマンド

| コマンド | 説明 |
|---------|------|
| `open <url>` | URL を開く |
| `snapshot` | アクセシビリティツリーを取得（AI 向け） |
| `click <sel>` | 要素をクリック（CSS セレクタ or `@ref`） |
| `fill <sel> <text>` | フォームに入力 |
| `type <sel> <text>` | テキストを入力 |
| `screenshot [path]` | スクリーンショットを取得 |
| `get text <sel>` | 要素のテキストを取得 |
| `wait <sel\|ms>` | 要素または時間を待機 |
| `eval <js>` | JavaScript を実行 |
| `close` | ブラウザを閉じる |

### Snapshot オプション

| オプション | 説明 |
|-----------|------|
| `-i, --interactive` | インタラクティブな要素のみ |
| `-c, --compact` | 空の構造要素を除去 |
| `-d, --depth <n>` | ツリーの深さを制限 |
| `-s, --selector <sel>` | 特定のセレクタにスコープ |

### 運用ルール（このハーネスでの推奨）

- UI/UX不具合や画面上の再現が必要なデバッグでは、**agent-browser を最優先で使う**
- 他のブラウザ系 MCP ツール（chrome-devtools, playwright）より先に試す
- agent-browser が使えない環境では、以下で代替する:
  - 再現手順（URL/手順/期待値/実際）
  - スクリーンショット/動画
  - コンソールログ/ネットワークログ
  - 可能なら自動E2E（Playwright/Cypress等）の最小再現

### セッション管理

複数のセッションを並列で管理できます：

```bash
# セッションを指定して実行
agent-browser --session login open https://example.com/login
agent-browser --session admin open https://example.com/admin

# セッション一覧
agent-browser session list
```

