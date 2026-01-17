# Stripe Webhook イベント一覧

## サブスクリプションで必須のイベント

### checkout.session.completed

**タイミング**: Checkout 完了時（初回決済成功）

```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_xxx",
      "customer": "cus_xxx",
      "subscription": "sub_xxx",
      "metadata": {
        "user_id": "123"
      }
    }
  }
}
```

**処理**:
```typescript
case 'checkout.session.completed': {
  const session = event.data.object;
  await db.members.upsert({
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
    status: 'active',
    user_id: session.metadata.user_id
  });
  break;
}
```

---

### customer.subscription.updated

**タイミング**: サブスク更新時（プラン変更、自動更新など）

```json
{
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_xxx",
      "status": "active",  // active | past_due | canceled | unpaid
      "current_period_end": 1234567890,
      "cancel_at_period_end": false
    }
  }
}
```

**処理**:
```typescript
case 'customer.subscription.updated': {
  const sub = event.data.object;
  await db.members.update({
    where: { stripe_subscription_id: sub.id },
    data: {
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000),
      cancel_at_period_end: sub.cancel_at_period_end
    }
  });
  break;
}
```

---

### customer.subscription.deleted

**タイミング**: サブスク完全削除時（解約完了後）

```typescript
case 'customer.subscription.deleted': {
  const sub = event.data.object;
  await db.members.update({
    where: { stripe_subscription_id: sub.id },
    data: { status: 'canceled' }
  });
  break;
}
```

---

### invoice.payment_failed

**タイミング**: 決済失敗時（カード期限切れ等）

```typescript
case 'invoice.payment_failed': {
  const invoice = event.data.object;
  await sendEmail({
    to: invoice.customer_email,
    subject: '決済が失敗しました',
    body: 'カード情報を更新してください'
  });

  await notifyDiscord({
    channel: 'payment-alerts',
    message: `決済失敗: ${invoice.customer_email}`
  });
  break;
}
```

---

## Webhook エンドポイント設定

### Stripe Dashboard

1. Developers → Webhooks → Add endpoint
2. URL: `https://your-domain.com/api/stripe/webhook`
3. イベント選択:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

### 署名シークレット

```bash
# Dashboard から取得
STRIPE_WEBHOOK_SECRET=whsec_xxx

# ローカル開発時は stripe listen で自動生成
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Ready! Your webhook signing secret is whsec_xxx
```

---

## デバッグ

```bash
# イベントログ確認
stripe logs tail

# 特定イベントを手動発火
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed

# Webhook 再送信
stripe events resend evt_xxx
```
