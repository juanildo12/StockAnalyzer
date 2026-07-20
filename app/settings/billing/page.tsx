"use client";

import { useState, useEffect } from "react";
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "See the Signal",
    icon: "📊",
    gradient: `linear-gradient(135deg, ${C.bgElevated} 0%, ${C.bgElevated} 100%)`,
    accent: C.textMuted,
    features: [
      "5 stock scores/day",
      "Morning briefing (30min delay)",
      "Basic screener",
      "3 watchlist slots",
      "2 price alerts",
      "Market overview",
      "Earnings calendar",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    tagline: "Trade with AI",
    icon: "🤖",
    popular: true,
    gradient: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentLight} 50%, ${C.info} 100%)`,
    accent: C.accentLight,
    features: [
      "Unlimited stock scores",
      "AI stock analysis (verdict + conviction)",
      "AI trading coach (unlimited chat)",
      "Smart alerts with email delivery",
      "Breakout screener (multi-timeframe)",
      "Auto-share TP hits (Twitter/LinkedIn/Discord)",
      "Full backtesting suite",
      "Real-time morning briefing",
      "50 watchlist + 20 active alerts",
      "All 6 training difficulty tiers",
      "120 req/min API rate",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 99,
    tagline: "Maximum Edge",
    icon: "⚡",
    gradient: `linear-gradient(135deg, ${C.warning} 0%, ${C.negative} 100%)`,
    accent: C.warning,
    features: [
      "Everything in Pro",
      "Options analysis (12+ strategies)",
      "Options screener (IV, Greeks)",
      "Graham value analysis",
      "Net-net working capital screeners",
      "Enriched data (sentiment, insider)",
      "ML signal classification (neural net)",
      "Portfolio tracker (multi-position P&L)",
      "Custom alert strategies",
      "Unlimited smart alerts + social share",
      "300 req/min API rate",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    tagline: "Platform as Infrastructure",
    icon: "🏢",
    customPricing: true,
    gradient: `linear-gradient(135deg, ${C.positive} 0%, ${C.positive} 100%)`,
    accent: C.positive,
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
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

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
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.textSecondary,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: "40px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow effects */}
      <div style={{
        position: "absolute", top: "-200px", left: "50%", transform: "translateX(-50%)",
        width: "800px", height: "600px",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "50%", right: "-200px",
        width: "600px", height: "600px",
        background: "radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 16px", borderRadius: "20px",
            background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)",
            fontSize: "12px", fontWeight: 600, color: C.accentLight,
            marginBottom: "20px", letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.accentLight }} />
            Pricing
          </div>
          <h1 style={{
            fontSize: "48px", fontWeight: 800, margin: "0 0 12px",
            background: `linear-gradient(135deg, ${C.textPrimary} 0%, ${C.textMuted} 100%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            lineHeight: 1.1, letterSpacing: "-1px",
          }}>
            Choose Your Edge
          </h1>
          <p style={{
            fontSize: "18px", color: C.textMuted, maxWidth: "560px",
            margin: "0 auto", lineHeight: 1.6,
          }}>
            Free traders see the signals. Paid traders act on them.
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div style={{
            marginBottom: "32px", padding: "14px 20px",
            borderRadius: "12px",
            background: message.includes("successfully")
              ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${message.includes("successfully") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: message.includes("successfully") ? "#6ee7b7" : "#fca5a5",
            textAlign: "center", fontSize: "14px", fontWeight: 500,
            backdropFilter: "blur(10px)",
          }}>
            {message}
          </div>
        )}

        {/* Plan cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px",
          alignItems: "start",
        }}>
          {PLANS.map((plan) => {
            const isActive = currentPlan === plan.id;
            const isDowngrade = planHierarchy[plan.id] < currentLevel;
            const isUpgrade = planHierarchy[plan.id] > currentLevel;
            const isHovered = hoveredPlan === plan.id;
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                style={{
                  position: "relative",
                  borderRadius: "16px",
                  padding: "1px",
                  background: isActive
                    ? plan.gradient
                    : isPopular
                    ? "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(99,102,241,0.3), rgba(59,130,246,0.5))"
                    : isHovered
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.05)",
                  transition: "all 0.3s ease",
                  transform: isHovered ? "translateY(-4px)" : "none",
                  boxShadow: isActive
                    ? `0 0 30px ${plan.accent}30`
                    : isPopular
                    ? "0 0 40px rgba(124,58,237,0.15)"
                    : isHovered
                    ? "0 20px 60px rgba(0,0,0,0.4)"
                    : "0 4px 20px rgba(0,0,0,0.2)",
                }}
              >
                {/* Popular badge */}
                {isPopular && !isActive && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    padding: "4px 14px", borderRadius: "12px",
                    background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
                    fontSize: "11px", fontWeight: 700, color: C.textPrimary,
                    letterSpacing: "0.8px", textTransform: "uppercase",
                    boxShadow: "0 4px 12px rgba(124,58,237,0.4)",
                    zIndex: 2,
                  }}>
                    MOST POPULAR
                  </div>
                )}

                {/* Active badge */}
                {isActive && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    padding: "4px 14px", borderRadius: "12px",
                    background: plan.gradient,
                    fontSize: "11px", fontWeight: 700, color: C.textPrimary,
                    letterSpacing: "0.8px", textTransform: "uppercase",
                    boxShadow: `0 4px 12px ${plan.accent}40`,
                    zIndex: 2,
                  }}>
                    CURRENT PLAN
                  </div>
                )}

                <div style={{
                  background: C.bgCard,
                  borderRadius: "15px",
                  padding: "32px 24px",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}>
                  {/* Plan header */}
                  <div style={{ textAlign: "center", marginBottom: "24px" }}>
                    <div style={{
                      fontSize: "32px", marginBottom: "12px",
                    }}>{plan.icon}</div>
                    <h3 style={{
                      fontSize: "20px", fontWeight: 700, color: C.textPrimary,
                      margin: "0 0 4px",
                    }}>{plan.name}</h3>
                    <p style={{
                      fontSize: "13px", color: C.textMuted, margin: 0,
                    }}>{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div style={{
                    textAlign: "center", marginBottom: "28px",
                    padding: "16px 0",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    {plan.customPricing ? (
                      <div>
                        <span style={{ fontSize: "28px", fontWeight: 800, color: C.textPrimary }}>Custom</span>
                        <p style={{ fontSize: "12px", color: C.textMuted, margin: "4px 0 0" }}>Tailored for your team</p>
                      </div>
                    ) : (
                      <div>
                        <span style={{
                          fontSize: "44px", fontWeight: 800, color: C.textPrimary,
                          lineHeight: 1,
                        }}>${plan.price}</span>
                        <span style={{
                          fontSize: "16px", fontWeight: 500, color: C.textMuted,
                          marginLeft: "2px",
                        }}>/mo</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul style={{
                    listStyle: "none", padding: 0, margin: 0,
                    flex: 1, marginBottom: "24px",
                  }}>
                    {plan.features.map((feature, i) => (
                      <li key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: "10px",
                        padding: "7px 0",
                        fontSize: "13px", color: C.textSecondary, lineHeight: 1.4,
                      }}>
                        <svg
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                          style={{ flexShrink: 0, marginTop: "2px" }}
                        >
                          <circle cx="8" cy="8" r="8" fill={plan.accent} opacity="0.15" />
                          <path
                            d="M5 8l2 2 4-4"
                            stroke={plan.accent}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {isActive ? (
                    <button
                      onClick={handleManage}
                      disabled={loading === "portal"}
                      style={{
                        width: "100%", padding: "13px 20px", borderRadius: "10px",
                        border: `1px solid ${plan.accent}40`,
                        background: `${plan.accent}15`,
                        color: plan.accent,
                        fontSize: "14px", fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {loading === "portal" ? "Loading..." : "Manage Plan"}
                    </button>
                  ) : plan.customPricing ? (
                    <button
                      onClick={() => window.location.href = "mailto:sales@breakoutfinder.com"}
                      style={{
                        width: "100%", padding: "13px 20px", borderRadius: "10px",
                        border: "1px solid rgba(16,185,129,0.3)",
                        background: "rgba(16,185,129,0.1)",
                        color: C.positive,
                        fontSize: "14px", fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      Contact Sales
                    </button>
                  ) : isDowngrade ? (
                    <button
                      disabled
                      style={{
                        width: "100%", padding: "13px 20px", borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(255,255,255,0.02)",
                        color: C.textMuted,
                        fontSize: "14px", fontWeight: 600,
                        cursor: "not-allowed",
                      }}
                    >
                      Downgrade
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={loading === plan.id}
                      style={{
                        width: "100%", padding: "13px 20px", borderRadius: "10px",
                        border: "none",
                        background: isPopular
                          ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight}, ${C.info})`
                          : plan.gradient,
                        color: C.textPrimary,
                        fontSize: "14px", fontWeight: 600,
                        cursor: loading === plan.id ? "wait" : "pointer",
                        opacity: loading === plan.id ? 0.7 : 1,
                        transition: "all 0.2s ease",
                        boxShadow: isPopular
                          ? "0 4px 20px rgba(124,58,237,0.4)"
                          : `0 4px 20px ${plan.accent}30`,
                        letterSpacing: "0.3px",
                      }}
                    >
                      {loading === plan.id ? "Redirecting..." : isUpgrade ? `Upgrade to ${plan.name}` : `Get ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: "48px", textAlign: "center",
          padding: "24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{
            display: "flex", justifyContent: "center", gap: "32px",
            flexWrap: "wrap",
          }}>
            {[
              { icon: "🔒", text: "SSL encrypted" },
              { icon: "💳", text: "Secure payments via LemonSqueezy" },
              { icon: "↩️", text: "7-day money-back guarantee" },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "8px",
                fontSize: "13px", color: C.textMuted,
              }}>
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
