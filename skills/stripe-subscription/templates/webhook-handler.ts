/**
 * Stripe Webhook ハンドラー テンプレート
 *
 * 使い方:
 * 1. このファイルを app/api/stripe/webhook/route.ts にコピー
 * 2. DB 操作部分を実際の実装に置換
 * 3. Stripe Dashboard で Webhook エンドポイントを設定
 */

import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// ========================================
// Webhook エンドポイント
// ========================================

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  // 署名検証
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`Received event: ${event.type}`);

  // イベント処理
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Stripe にリトライさせるため 500 を返す
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// ========================================
// イベントハンドラー
// ========================================

/**
 * Checkout 完了 - 初回決済成功
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('Missing user_id in metadata');
    return;
  }

  console.log(`Checkout completed for user: ${userId}`);

  // TODO: DB に会員情報を保存
  // await db.members.upsert({
  //   where: { user_id: userId },
  //   create: {
  //     user_id: userId,
  //     stripe_customer_id: customerId,
  //     stripe_subscription_id: subscriptionId,
  //     status: 'active',
  //   },
  //   update: {
  //     stripe_customer_id: customerId,
  //     stripe_subscription_id: subscriptionId,
  //     status: 'active',
  //   },
  // });

  // TODO: Discord 通知
  // await notifyDiscord(`新規契約: ${session.customer_email}`);
}

/**
 * サブスク更新 - プラン変更/自動更新
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  console.log(`Subscription updated: ${subscriptionId}, status: ${status}`);

  // TODO: DB のステータスを更新
  // await db.members.update({
  //   where: { stripe_subscription_id: subscriptionId },
  //   data: {
  //     status,
  //     current_period_end: currentPeriodEnd,
  //     cancel_at_period_end: cancelAtPeriodEnd,
  //   },
  // });

  // 解約予定の場合は通知
  if (cancelAtPeriodEnd) {
    console.log(`Subscription ${subscriptionId} will cancel at period end`);
    // TODO: Discord 通知
  }
}

/**
 * サブスク削除 - 解約完了
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  console.log(`Subscription deleted: ${subscriptionId}`);

  // TODO: DB のステータスを無効化
  // await db.members.update({
  //   where: { stripe_subscription_id: subscriptionId },
  //   data: { status: 'canceled' },
  // });

  // TODO: Discord 通知
  // await notifyDiscord(`解約完了: ${subscriptionId}`);
}

/**
 * 決済失敗
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const email = invoice.customer_email;

  console.error(`Payment failed for customer: ${customerId}`);

  // TODO: エラーメール送信
  // await sendEmail({
  //   to: email,
  //   subject: '決済が失敗しました',
  //   body: 'カード情報を更新してください',
  // });

  // TODO: Discord アラート
  // await notifyDiscord(`決済失敗: ${email}`, 'payment-alerts');
}

// ========================================
// Next.js config (app/api/stripe/webhook/route.ts)
// ========================================

// Webhook は raw body が必要なため bodyParser を無効化
export const config = {
  api: {
    bodyParser: false,
  },
};
