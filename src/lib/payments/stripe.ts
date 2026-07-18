import { prisma } from "@/src/lib/prisma";
import crypto from "crypto";

// ─── Plan Configuration ──────────────────────────────────────────────────────
// Tier hierarchy: free(0) → pro(1) → elite(2) → enterprise(3)
// Pricing optimized for LTV: Free builds habit → Pro creates dependency → Elite maximizes ARPU

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    variantId: null,
    features: [
      "5 stock scores/day",
      "Morning briefing (30min delay)",
      "Basic screener",
      "3 watchlist slots",
      "2 price alerts",
      "Market overview",
      "Earnings calendar",
      "Daily trading challenge",
    ],
    limits: {
      dailyScores: 5,
      watchlist: 3,
      alerts: 2,
      smartAlerts: 0,
      screeners: "basic",
      aiAnalysis: false,
      aiCoach: false,
      options: false,
      backtest: false,
      socialShare: false,
      breakoutScreener: false,
      enrichedData: false,
      portfolio: false,
      customAlerts: false,
      grahamAnalysis: false,
      nnwcAnalysis: false,
      mlClassification: false,
    },
  },
  pro: {
    name: "Pro",
    price: 49,
    variantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID || "",
    features: [
      "Unlimited stock scores",
      "AI stock analysis (verdict + conviction)",
      "AI trading coach (unlimited chat)",
      "Smart alerts with email delivery",
      "Breakout screener (multi-timeframe)",
      "Auto-share TP hits (Twitter + LinkedIn + Discord)",
      "Full backtesting suite",
      "Real-time morning briefing",
      "50 watchlist slots",
      "20 active alerts + smart alerts",
      "All 6 training difficulty tiers",
      "120 req/min API rate",
    ],
    limits: {
      dailyScores: Infinity,
      watchlist: 50,
      alerts: 20,
      smartAlerts: 5,
      screeners: "all",
      aiAnalysis: true,
      aiCoach: true,
      options: false,
      backtest: true,
      socialShare: true,
      breakoutScreener: true,
      enrichedData: false,
      portfolio: false,
      customAlerts: false,
      grahamAnalysis: false,
      nnwcAnalysis: false,
      mlClassification: false,
    },
  },
  elite: {
    name: "Elite",
    price: 99,
    variantId: process.env.LEMONSQUEEZY_ELITE_VARIANT_ID || "",
    features: [
      "Everything in Pro",
      "Options analysis (12+ strategies)",
      "Options screener (IV, Greeks, unusual volume)",
      "Graham value analysis",
      "Net-net working capital screeners",
      "Enriched data (sentiment, insider, institutional)",
      "ML signal classification (neural network)",
      "Portfolio tracker (multi-position P&L)",
      "Custom alert strategies (define your rules)",
      "Unlimited smart alerts",
      "Unlimited social share",
      "300 req/min API rate",
      "Weekly performance report",
    ],
    limits: {
      dailyScores: Infinity,
      watchlist: Infinity,
      alerts: Infinity,
      smartAlerts: Infinity,
      screeners: "all",
      aiAnalysis: true,
      aiCoach: true,
      options: true,
      backtest: true,
      socialShare: true,
      breakoutScreener: true,
      enrichedData: true,
      portfolio: true,
      customAlerts: true,
      grahamAnalysis: true,
      nnwcAnalysis: true,
      mlClassification: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 0,
    variantId: process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID || "",
    features: [
      "Everything in Elite",
      "White-label API",
      "Multi-seat (up to 20)",
      "Custom scoring models",
      "Historical data export",
      "Priority support (2h SLA)",
      "Custom integrations (TradeStation, IBKR, webhooks)",
      "Compliance dashboard",
      "Dedicated infrastructure",
    ],
    limits: {
      dailyScores: Infinity,
      watchlist: Infinity,
      alerts: Infinity,
      smartAlerts: Infinity,
      screeners: "all",
      aiAnalysis: true,
      aiCoach: true,
      options: true,
      backtest: true,
      socialShare: true,
      breakoutScreener: true,
      enrichedData: true,
      portfolio: true,
      customAlerts: true,
      grahamAnalysis: true,
      nnwcAnalysis: true,
      mlClassification: true,
    },
  },
} as const;

export type PlanTier = keyof typeof PLANS;

// ─── LemonSqueezy API Client ─────────────────────────────────────────────────

const LS_API = "https://api.lemonsqueezy.com/v1";

function lsHeaders() {
  return {
    Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.api+json",
  };
}

async function lsFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${LS_API}${path}`, {
    ...options,
    headers: { ...lsHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LemonSqueezy API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: PlanTier
): Promise<string> {
  const planConfig = PLANS[plan];
  if (!planConfig.variantId) {
    throw new Error(`No LemonSqueezy variant ID for plan: ${plan}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stock-analyzer-new.vercel.app";

  const data = await lsFetch("/checkouts", {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            custom: {
              userId,
              plan,
            },
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: process.env.LEMONSQUEEZY_STORE_ID,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: planConfig.variantId,
            },
          },
        },
      },
    }),
  });

  return data.data.attributes.url;
}

// ─── Customer Portal ─────────────────────────────────────────────────────────

export async function createPortalSession(userId: string): Promise<string> {
  const subscription = await prisma.subscriptions.findUnique({
    where: { userId },
  });

  if (!subscription?.lemonSqueezySubscriptionId) {
    throw new Error("No LemonSqueezy subscription found");
  }

  const data = await lsFetch(
    `/subscriptions/${subscription.lemonSqueezySubscriptionId}/portal`
  );

  return data.data.attributes.urls.customer_portal;
}

// ─── Webhook Verification ────────────────────────────────────────────────────

export function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

export async function handleWebhook(event: any): Promise<void> {
  const eventName = event.meta?.event_name;
  const attrs = event.data?.attributes;

  if (!eventName || !attrs) {
    console.error("[LemonSqueezy Webhook] Invalid event structure");
    return;
  }

  console.log(`[LemonSqueezy Webhook] Event: ${eventName}`);

  // Extract userId from custom_data
  const userId = attrs.custom_data?.userId || attrs.user_email;
  const subscriptionId = event.data?.id;
  const variantId = String(attrs.variant_id);

  // Map variant ID to plan
  let plan: PlanTier = "free";
  for (const [key, config] of Object.entries(PLANS)) {
    if (config.variantId === variantId) {
      plan = key as PlanTier;
      break;
    }
  }

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated": {
      const status = attrs.status;
      let dbStatus = "active";
      if (status === "past_due") dbStatus = "past_due";
      else if (status === "cancelled") dbStatus = "canceled";
      else if (status === "expired") dbStatus = "canceled";
      else if (status === "paused") dbStatus = "paused";

      if (userId) {
        await prisma.subscriptions.upsert({
          where: { userId },
          update: {
            lemonSqueezySubscriptionId: subscriptionId,
            lemonSqueezyProductId: String(attrs.product_id),
            plan,
            status: dbStatus,
            currentPeriodStart: attrs.renews_at ? new Date(attrs.renews_at) : null,
            currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : null,
          },
          create: {
            userId,
            lemonSqueezySubscriptionId: subscriptionId,
            lemonSqueezyProductId: String(attrs.product_id),
            plan,
            status: dbStatus,
            currentPeriodStart: attrs.renews_at ? new Date(attrs.renews_at) : null,
            currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : null,
          },
        });
        console.log(`[LemonSqueezy] User ${userId} → plan: ${plan}, status: ${dbStatus}`);
      }
      break;
    }

    case "subscription_cancelled": {
      if (userId) {
        await prisma.subscriptions.updateMany({
          where: { lemonSqueezySubscriptionId: subscriptionId },
          data: {
            plan: "free",
            status: "canceled",
            cancelAt: attrs.ends_at ? new Date(attrs.ends_at) : new Date(),
          },
        });
        console.log(`[LemonSqueezy] User ${userId} subscription cancelled`);
      }
      break;
    }

    case "subscription_expired": {
      if (userId) {
        await prisma.subscriptions.updateMany({
          where: { lemonSqueezySubscriptionId: subscriptionId },
          data: {
            plan: "free",
            status: "canceled",
            lemonSqueezySubscriptionId: null,
          },
        });
        console.log(`[LemonSqueezy] User ${userId} subscription expired`);
      }
      break;
    }

    case "subscription_payment_failed": {
      if (userId) {
        await prisma.subscriptions.updateMany({
          where: { lemonSqueezySubscriptionId: subscriptionId },
          data: { status: "past_due" },
        });
        console.log(`[LemonSqueezy] User ${userId} payment failed`);
      }
      break;
    }

    case "subscription_payment_success": {
      if (userId) {
        await prisma.subscriptions.updateMany({
          where: { lemonSqueezySubscriptionId: subscriptionId },
          data: {
            status: "active",
            currentPeriodStart: attrs.renews_at ? new Date(attrs.renews_at) : null,
          },
        });
      }
      break;
    }

    default:
      console.log(`[LemonSqueezy] Unhandled event: ${eventName}`);
  }
}
