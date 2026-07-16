import Stripe from "stripe";
import { prisma } from "@/src/lib/prisma";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("[Stripe] STRIPE_SECRET_KEY not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

// ─── Plan Configuration ──────────────────────────────────────────────────────
// Tier hierarchy: free(0) → pro(1) → elite(2) → enterprise(3)
// Pricing optimized for LTV: Free builds habit → Pro creates dependency → Elite maximizes ARPU

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    stripePriceId: null,
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
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
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
    stripePriceId: process.env.STRIPE_ELITE_PRICE_ID || "",
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
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
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

// ─── Stripe Customer ─────────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const subscription = await prisma.subscriptions.findUnique({
    where: { userId },
  });

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });

  await prisma.subscriptions.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: {
      userId,
      stripeCustomerId: customer.id,
      plan: "free",
      status: "active",
    },
  });

  return customer.id;
}

// ─── Checkout & Portal ───────────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: PlanTier
): Promise<string> {
  const planConfig = PLANS[plan];
  if (!planConfig.stripePriceId) {
    throw new Error(`No Stripe price ID for plan: ${plan}`);
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: planConfig.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://stock-analyzer-new.vercel.app"}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://stock-analyzer-new.vercel.app"}/settings/billing?canceled=true`,
    metadata: { userId, plan },
  });

  return session.url!;
}

export async function createPortalSession(
  userId: string
): Promise<string> {
  const subscription = await prisma.subscriptions.findUnique({
    where: { userId },
  });

  if (!subscription?.stripeCustomerId) {
    throw new Error("No Stripe customer found");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://stock-analyzer-new.vercel.app"}/settings/billing`,
  });

  return session.url;
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

export async function handleWebhook(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as PlanTier;

      if (userId && plan) {
        await prisma.subscriptions.upsert({
          where: { userId },
          update: {
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: "active",
            currentPeriodStart: new Date(),
          },
          create: {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: "active",
            currentPeriodStart: new Date(),
          },
        });

        console.log(`[Stripe] User ${userId} subscribed to ${plan}`);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
        const userId = stripeSub.metadata?.userId;

        if (userId) {
          await prisma.subscriptions.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: {
              status: "active",
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            },
          });
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        await prisma.subscriptions.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: "past_due" },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (userId) {
        const priceId = subscription.items.data[0]?.price.id;
        let plan: PlanTier = "free";

        for (const [key, config] of Object.entries(PLANS)) {
          if (config.stripePriceId === priceId) {
            plan = key as PlanTier;
            break;
          }
        }

        await prisma.subscriptions.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan,
            status: subscription.status === "active" ? "active" : subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;

      if (userId) {
        await prisma.subscriptions.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: "free",
            status: "canceled",
            stripeSubscriptionId: null,
          },
        });

        console.log(`[Stripe] User ${userId} subscription canceled`);
      }
      break;
    }
  }
}
