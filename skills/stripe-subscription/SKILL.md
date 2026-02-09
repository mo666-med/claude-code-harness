---
name: stripe-subscription
description: ""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - mcp__stripe__*
---

# /stripe-subscription - サブスク課金完全自動化

**目的**: Stripe サブスクリプション課金を MCP + テンプレートで一発実装

---

## 機能概要

| 機能 | MCP Tool | 説明 |
|------|----------|------|
| 商品作成 | `stripe_create_product` | 商品マスタを作成 |
| 価格設定 | `stripe_create_price` | recurring で月額/年額設定 |
| クーポン | `stripe_create_coupon` | 割引クーポン発行 |
| Checkout | `stripe_create_checkout_session` | 決済ページ生成 |
| ドキュメント検索 | `stripe_search_documentation` | 公式ドキュメント参照 |

---

## 実行フロー

```
/stripe-subscription
    ↓
Step 1: 要件ヒアリング
    - 商品名、価格、請求サイクル（月/年）
    - 無料トライアル期間
    - クーポン要否
    ↓
Step 2: Stripe リソース作成（MCP）
    - stripe_create_product
    - stripe_create_price (recurring)
    - stripe_create_coupon（任意）
    ↓
Step 3: コード生成
    - Checkout Session API
    - Webhook ハンドラー
    - 顧客ポータル設定
    ↓
Step 4: テスト（Stripe CLI）
    - stripe listen --forward-to
    - stripe trigger checkout.session.completed
    ↓
Step 5: 本番デプロイ
```

---

## Step 0: セキュリティチェック

```markdown
🔐 Stripe サブスク実装チェックリスト

### 必須確認
- [ ] STRIPE_SECRET_KEY は環境変数から取得
- [ ] Webhook 署名検証を実装
- [ ] 金額はサーバー側で確定（クライアント改ざん防止）
- [ ] 顧客ポータルで解約可能に設定

### 推奨
- [ ] idempotency_key で重複防止
- [ ] subscription.updated イベントも処理
- [ ] 失敗した決済のリトライ設定
```

---

## 参照ドキュメント

| ファイル | 内容 |
|----------|------|
| [references/subscription-flow.md](references/subscription-flow.md) | サブスク実装フロー詳細 |
| [references/webhook-events.md](references/webhook-events.md) | 必須 Webhook イベント |
| [references/testing-checklist.md](references/testing-checklist.md) | Stripe CLI テスト手順 |
| [templates/checkout-session.ts](templates/checkout-session.ts) | Checkout テンプレート |
| [templates/webhook-handler.ts](templates/webhook-handler.ts) | Webhook テンプレート |

---

## クイックスタート

### 1. 商品・価格を MCP で作成

```
Claude: stripe_create_product を使って「プレミアムプラン」を作成して
Claude: stripe_create_price で月額 980 円の定期課金を設定して
```

### 2. テンプレートから実装

```
Claude: templates/checkout-session.ts を参考に Checkout API を実装して
Claude: templates/webhook-handler.ts を参考に Webhook を実装して
```

### 3. Stripe CLI でテスト

```bash
# Webhook をローカルに転送
stripe listen --forward-to localhost:3000/api/stripe/webhook

# テストイベント発火
stripe trigger checkout.session.completed
```

---

## VibeCoder 向け説明

```markdown
💳 サブスク課金とは？

1. **商品を作る** = 売りたいサービスを登録
2. **価格を決める** = 月額いくら？年額いくら？
3. **決済ページを作る** = お客さんがカード情報を入力する画面
4. **完了を受け取る** = 決済が終わったら通知が来る（Webhook）

このスキルを使えば、全部自動でやってくれます！
```
