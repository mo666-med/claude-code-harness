/**
 * Stripe Checkout Session テンプレート
 *
 * 使い方:
 * 1. このファイルをプロジェクトにコピー
 * 2. 環境変数を設定
 * 3. priceId を実際の値に置換
 */

import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// ========================================
// 型定義
// ========================================

interface CreateCheckoutRequest {
  priceId: string;
  userId: string;
  email?: string;
  trialDays?: number;
  couponId?: string;
}

// ========================================
// Checkout Session 作成
// ========================================

export async function POST(req: NextRequest) {
  try {
    const body: CreateCheckoutRequest = await req.json();
    const { priceId, userId, email, trialDays, couponId } = body;

    // バリデーション
    if (!priceId || !userId) {
      return NextResponse.json(
        { error: 'priceId and userId are required' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Checkout Session 作成
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // リダイレクト先
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,

      // 顧客情報
      ...(email && { customer_email: email }),

      // サブスク設定
      subscription_data: {
        // 無料トライアル
        ...(trialDays && { trial_period_days: trialDays }),

        // メタデータ（Webhook で使用）
        metadata: {
          user_id: userId,
        },
      },

      // クーポン
      ...(couponId && {
        discounts: [{ coupon: couponId }],
      }),

      // クーポンコード入力欄を表示
      allow_promotion_codes: !couponId, // 直接指定時は非表示
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Checkout session creation failed:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ========================================
// 顧客ポータル（解約・プラン変更用）
// ========================================

export async function createPortalSession(customerId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/account`,
  });

  return session.url;
}

// ========================================
// フロントエンド呼び出し例
// ========================================

/*
// components/CheckoutButton.tsx

'use client';

import { useState } from 'react';

export function CheckoutButton({ priceId, userId }: { priceId: string; userId: string }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId }),
      });

      const { url, error } = await response.json();

      if (error) {
        alert(error);
        return;
      }

      // Stripe Checkout にリダイレクト
      window.location.href = url;
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('決済ページへの遷移に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
    >
      {loading ? '処理中...' : 'プランに申し込む'}
    </button>
  );
}
*/
