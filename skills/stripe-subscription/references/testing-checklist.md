# Stripe サブスク テストチェックリスト

## 環境準備

### 1. Stripe CLI セットアップ

```bash
# インストール確認
stripe --version

# ログイン
stripe login

# Webhook リスナー起動
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 2. 環境変数

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx  # stripe listen で表示される値
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

---

## テストシナリオ

### シナリオ 1: 正常な新規契約

- [ ] Checkout ページが開く
- [ ] テストカード `4242 4242 4242 4242` で決済成功
- [ ] success_url にリダイレクトされる
- [ ] Webhook `checkout.session.completed` が届く
- [ ] DB に会員レコードが作成される
- [ ] ステータスが `active` になる

```bash
# 手動テスト
stripe trigger checkout.session.completed
```

### シナリオ 2: 無料トライアル

- [ ] トライアル期間中は課金されない
- [ ] トライアル終了後に自動課金される
- [ ] `customer.subscription.updated` が届く

### シナリオ 3: 決済失敗

- [ ] テストカード `4000 0000 0000 0341` で決済失敗
- [ ] `invoice.payment_failed` が届く
- [ ] エラーメール/通知が送信される

```bash
# 手動テスト
stripe trigger invoice.payment_failed
```

### シナリオ 4: 解約

- [ ] 顧客ポータルで解約できる
- [ ] `cancel_at_period_end: true` になる
- [ ] 期間終了後に `customer.subscription.deleted` が届く
- [ ] ステータスが `canceled` になる

```bash
# 手動テスト
stripe trigger customer.subscription.deleted
```

### シナリオ 5: プラン変更

- [ ] 顧客ポータルでプラン変更できる
- [ ] `customer.subscription.updated` が届く
- [ ] 新しいプラン情報が DB に反映される

### シナリオ 6: クーポン適用

- [ ] Checkout でクーポンコードを入力できる
- [ ] 割引が適用される
- [ ] 正しい金額で決済される

---

## テストカード一覧

| カード番号 | 結果 |
|-----------|------|
| `4242 4242 4242 4242` | 成功 |
| `4000 0000 0000 0341` | 決済失敗（カード拒否） |
| `4000 0000 0000 9995` | 残高不足 |
| `4000 0000 0000 0077` | 3Dセキュア必須 |
| `4000 0025 0000 3155` | 3Dセキュア認証失敗 |

---

## 本番前チェック

### コード

- [ ] 署名検証が実装されている
- [ ] エラーハンドリングが適切
- [ ] ログ出力が十分
- [ ] 重複処理対策（idempotency）

### Stripe Dashboard

- [ ] 本番 Webhook エンドポイントが設定されている
- [ ] 本番 API キーに切り替え済み
- [ ] 商品・価格が本番モードで作成済み

### 監視

- [ ] 決済失敗の通知設定
- [ ] Webhook 失敗の監視
- [ ] Stripe Dashboard のアラート設定
