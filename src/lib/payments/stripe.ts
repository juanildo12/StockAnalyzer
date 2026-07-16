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

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    stripePriceId: null,
    features: [
      "Basic screener access",
      "Morning briefing",
      "5 watchlist items",
      "3 alerts",
    ],
    limits: {
      watchlist: 5,
      alerts: 3,
      screeners: "basic",
      aiAnalysis: false,
      options: false,
    },
  },
  starter: {
    name: "Starter",
    price: 29,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    features: [
      "All Free features",
      "Unlimited watchlist",
      "Unlimited alerts",
      "Options chain access",
      "7 screener models",
      "Email notifications",
    ],
    limits: {
      watchlist: Infinity,
      alerts: Infinity,
      screeners: "all",
      aiAnalysis: false,
      options: true,
    },
  },
  pro: {
    name: "Pro",
    price: 59,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "All Starter features",
      "AI stock analysis",
      "AI trading coach",
      "Backtesting",
      "Priority support",
      "API access",
    ],
    limits: {
      watchlist: Infinity,
      alerts: Infinity,
      screeners: "all",
      aiAnalysis: true,
      options: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "All Pro features",
      "Custom screeners",
      "Webhook access",
      "Dedicated support",
      "SLA guarantee",
    ],
    limits: {
      watchlist: Infinity,
      alerts: Infinity,
      screeners: "all",
      aiAnalysis: true,
      options: true,
    },
  },
} as const;

export type PlanTier = keyof typeof PLANS;

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const subscription = await prisma.subscriptions.findUnique({
    where: { userId },
  });

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });

  // Store in DB
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

        // Map price ID to plan
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
