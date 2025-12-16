---
name: optional
description: "拡張機能スキル群。認証、決済、デプロイ、アナリティクス等の機能を追加する際に使用。"
allowed-tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
metadata:
  skillport:
    category: optional
    tags: [auth, payments, deploy, analytics, components]
    alwaysApply: false
---

# Optional Skills

プロジェクトに追加できる拡張機能スキル群です。

---

## 発動条件

- 「ログイン機能を付けて」
- 「決済を追加したい」
- 「デプロイできるようにして」
- 「アクセス解析を入れて」

---

## 含まれる小スキル

### 認証/セキュリティ

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| auth | Clerk/Supabase Auth 認証 | 「ログイン機能」 |

### 決済

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| payments | Stripe 決済連携 | 「決済を付けたい」 |

### インフラ/デプロイ

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| deploy-setup | Vercel/Netlify 設定 | 「デプロイしたい」 |

### 分析/モニタリング

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| analytics | GA/Vercel Analytics | 「アクセス解析」 |
| health-check | 環境診断 | 「環境チェック」 |

### UI/コンポーネント

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| component | UIコンポーネント生成 | 「ヒーローを作って」 |
| feedback | フィードバックフォーム | 「問い合わせフォーム」 |

### ツール連携

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| setup-cursor | Cursor連携 | 「2-agent運用」 |
| notebooklm-yaml | NotebookLM YAML | 「スライドYAML」 |

### ワークフロー

| スキル | 用途 | トリガー例 |
|--------|------|-----------|
| auto-fix | レビュー指摘自動修正 | 「指摘を自動修正」 |
| handoff-to-impl | PM→Impl ハンドオフ | 「実装役に渡して」 |
| handoff-to-pm | Impl→PM ハンドオフ | 「PMに完了報告」 |

---

## ルーティングロジック

ユーザーの発言に含まれるキーワードで判断:

| キーワード | 小スキル |
|-----------|----------|
| ログイン、認証、サインアップ | auth/doc.md |
| 決済、Stripe、課金 | payments/doc.md |
| デプロイ、公開、Vercel | deploy-setup/doc.md |
| 解析、GA、アクセス | analytics/doc.md |
| コンポーネント、UI、ヒーロー | component/doc.md |
| フィードバック、問い合わせ | feedback/doc.md |
| Cursor、2-agent | setup-cursor/doc.md |
| 自動修正、fix | auto-fix/doc.md |
| PM、ハンドオフ | handoff-to-pm/doc.md or handoff-to-impl/doc.md |

---

## 実行手順

1. ユーザーのリクエストからキーワードを抽出
2. 適切な小スキルの doc.md を読む
3. その内容に従って実行
