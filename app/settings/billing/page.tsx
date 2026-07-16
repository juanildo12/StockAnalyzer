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
    features: [
      "Basic screener access",
      "Morning briefing",
      "5 watchlist items",
      "3 alerts",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 29,
    features: [
      "All Free features",
      "Unlimited watchlist",
      "Unlimited alerts",
      "Options chain access",
      "7 screener models",
      "Email notifications",
    ],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 59,
    features: [
      "All Starter features",
      "AI stock analysis",
      "AI trading coach",
      "Backtesting",
      "Priority support",
      "API access",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    features: [
      "All Pro features",
      "Custom screeners",
      "Webhook access",
      "Dedicated support",
      "SLA guarantee",
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

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Billing</h1>
        <p className="text-gray-400 mb-8">Choose the plan that fits your trading style</p>

        {message && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative p-6 ${
                currentPlan === plan.id
                  ? "border-[#00d4ff] shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                  : ""
              } ${plan.popular ? "border-[#ff00ff]" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[#ff00ff] text-white text-xs">MOST POPULAR</Badge>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold">
                  ${plan.price}
                  <span className="text-lg text-gray-400">/mo</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[#00d4ff] mt-0.5">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {currentPlan === plan.id ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleManage}
                  disabled={loading === "portal"}
                >
                  {loading === "portal" ? "Loading..." : "Current Plan"}
                </Button>
              ) : plan.price === 0 ? (
                <Button variant="outline" className="w-full" disabled>
                  Free
                </Button>
              ) : (
                <Button
                  className="w-full bg-[#00d4ff] text-black hover:bg-[#00b8e6]"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading === plan.id}
                >
                  {loading === plan.id ? "Loading..." : `Upgrade to ${plan.name}`}
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
