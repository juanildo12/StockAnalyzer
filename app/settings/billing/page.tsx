"use client";

import { useState, useEffect } from "react";
import Card from "@/src/components/ui/Card";
import Badge from "@/src/components/ui/Badge";
import Button from "@/src/components/ui/Button";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "See the Signal",
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
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    tagline: "Trade with AI",
    popular: true,
    features: [
      "Unlimited stock scores",
      "AI stock analysis (verdict + conviction)",
      "AI trading coach (unlimited chat)",
      "Smart alerts with email delivery",
      "Breakout screener (multi-timeframe)",
      "Auto-share TP hits (Twitter/LinkedIn/Discord)",
      "Full backtesting suite",
      "Real-time morning briefing",
      "50 watchlist slots",
      "20 active alerts + smart alerts",
      "All 6 training difficulty tiers",
      "120 req/min API rate",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 99,
    tagline: "Maximum Edge",
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
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    tagline: "Platform as Infrastructure",
    customPricing: true,
    features: [
      "Everything in Elite",
      "White-label API",
      "Multi-seat (up to 20)",
      "Custom scoring models",
      "Historical data export",
      "Priority support (2h SLA)",
      "Custom integrations (TradeStation, IBKR)",
      "Compliance dashboard",
      "Dedicated infrastructure",
    ],
  },
];

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setMessage("Subscription activated successfully!");
      fetchSubscription();
    }
    if (params.get("canceled") === "true") {
      setMessage("Subscription canceled.");
    }
  }, []);

  async function fetchSubscription() {
    try {
      const res = await fetch("/api/v1/payments/subscription");
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    }
  }

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function handleUpgrade(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/v1/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage("Failed to create checkout session");
      }
    } catch (error) {
      setMessage("Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading("portal");
    try {
      const res = await fetch("/api/v1/payments/portal", {
        method: "POST",
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      setMessage("Failed to open billing portal");
    } finally {
      setLoading(null);
    }
  }

  const planHierarchy: Record<string, number> = { free: 0, pro: 1, elite: 2, enterprise: 3 };
  const currentLevel = planHierarchy[currentPlan] ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Choose Your Edge</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Free traders see the signals. Paid traders act on them. Pick the plan that matches how seriously you trade.
          </p>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-center">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const isActive = currentPlan === plan.id;
            const isDowngrade = planHierarchy[plan.id] < currentLevel;
            const isUpgrade = planHierarchy[plan.id] > currentLevel;

            return (
              <Card
                key={plan.id}
                className={`relative p-6 flex flex-col ${
                  isActive
                    ? "border-[#00d4ff] shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                    : ""
                } ${plan.popular ? "border-[#ff00ff] shadow-[0_0_20px_rgba(255,0,255,0.15)]" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#ff00ff] text-white text-xs px-3 py-1">MOST POPULAR</Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{plan.tagline}</p>
                  <div className="text-4xl font-bold">
                    {plan.customPricing ? (
                      <span className="text-2xl">Custom</span>
                    ) : (
                      <>
                        ${plan.price}
                        <span className="text-lg text-gray-400">/mo</span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-[#00d4ff] mt-0.5 shrink-0">✓</span>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isActive ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleManage}
                    disabled={loading === "portal"}
                  >
                    {loading === "portal" ? "Loading..." : "Current Plan"}
                  </Button>
                ) : plan.customPricing ? (
                  <Button
                    variant="outline"
                    className="w-full border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff10]"
                    onClick={() => window.location.href = "mailto:sales@breakoutfinder.com"}
                  >
                    Contact Sales
                  </Button>
                ) : isDowngrade ? (
                  <Button variant="outline" className="w-full" disabled>
                    Downgrade
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? "bg-[#ff00ff] text-white hover:bg-[#e600e6]"
                        : "bg-[#00d4ff] text-black hover:bg-[#00b8e6]"
                    }`}
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loading === plan.id}
                  >
                    {loading === plan.id ? "Loading..." : isUpgrade ? `Upgrade to ${plan.name}` : `Get ${plan.name}`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        {/* Feature comparison hint */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            All paid plans include 7-day money-back guarantee. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
