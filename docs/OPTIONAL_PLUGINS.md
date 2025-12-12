# Optional Plugins

このリポジトリ（`claude-code-harness`）本体は、機能追加を「同梱」ではなく **任意の外部プラグイン導入**として扱えるようにしています。

---

## Dev Browser（推奨: UIデバッグ/検証）

`dev-browser` は、Claude Code から **ブラウザ操作（Playwright）を行い、画面で検証してループを閉じる**ためのプラグインです。

- **向いている用途**: UIの不具合調査、クリック/フォーム/遷移などのクリティカルパス検証、見た目の微調整の反復
- **本体に同梱しない理由**: 依存（Bun/Playwright）と実行環境（GUI/ブラウザ）要件があり、全員に強制すると運用コストが増えるため

参照: `https://github.com/SawyerHood/dev-browser`

### 前提条件

- Claude Code CLI がインストール済み
- Bun runtime（v1.0+）

### インストール（外部プラグインとして）

Claude Code 上で実行:

```
/plugin marketplace add SawyerHood/dev-browser

# 追加できたら marketplace 名を確認（marketplace.json の "name" が使われます）
/plugin marketplace list

# 推奨: 対話UIで「Browse Plugins」から dev-browser を探してインストール
/plugin

# もしくは（marketplace list で確認した名前を使って）直接インストール
# /plugin install dev-browser@<marketplace-name>
```

インストール後は **Claude Code を再起動**して有効化します。

> 注: もし `/plugin marketplace add` が失敗する場合、そのリポジトリは Marketplace（`.claude-plugin/marketplace.json`）ではない可能性があります。`dev-browser` 側の README の手順に従ってください。

### 運用ルール（このハーネスでの推奨）

- UI/UX不具合や画面上の再現が必要なデバッグでは、**dev-browser 導入済みなら最優先で使う**
- dev-browser が使えない環境では、以下で代替する:
  - 再現手順（URL/手順/期待値/実際）
  - スクリーンショット/動画
  - コンソールログ/ネットワークログ
  - 可能なら自動E2E（Playwright/Cypress等）の最小再現


