import { ShareTrigger } from "./types";

export const SHARE_CONFIG = {
  // ── Deduplication ──────────────────────────────
  cooldownHours: 48,

  // ── Min requirements to share ──────────────────
  minScore: 65,
  minReturnPct: 3,

  // ── Card dimensions (Open Graph) ──────────────
  cardWidth: 1200,
  cardHeight: 630,

  // ── Rate limits per platform (daily) ──────────
  maxPerDay: {
    twitter: 5,
    linkedin: 3,
    discord: 10,
  },
} as const;

export const CAPTION_TEMPLATES = {
  twitter: (s: ShareTrigger) => {
    const emoji = s.hitType === "TP1" ? "🎯" : "🏆";
    const returnStr = s.returnPct >= 0 ? `+${s.returnPct.toFixed(1)}%` : `${s.returnPct.toFixed(1)}%`;
    return `${emoji} $${s.symbol} hit ${s.hitType} → ${returnStr}\n\nScore: ${s.score}/100 (Grade ${s.grade})\nEntry: $${s.entryPrice.toFixed(2)} → Target: $${s.hitPrice.toFixed(2)}\nHeld: ${s.heldDays}d | R/R ${s.riskReward.toFixed(1)}:1\n\n#BreakoutTrading #StockMarket`;
  },
  linkedin: (s: ShareTrigger) => {
    const returnStr = s.returnPct >= 0 ? `+${s.returnPct.toFixed(1)}%` : `${s.returnPct.toFixed(1)}%`;
    return (
      `${s.hitType === "TP1" ? "🎯" : "🏆"} ${s.symbol} reached ${s.hitType} — ${returnStr} return\n\n` +
      `Signal scored ${s.score}/100 (Grade ${s.grade}) with ${s.riskReward.toFixed(1)}:1 R/R ratio.\n` +
      `Entry $${s.entryPrice.toFixed(2)} → Exit $${s.hitPrice.toFixed(2)} over ${s.heldDays} days.\n\n` +
      `Quantitative analysis powered by 12-factor scoring engine.\n\n` +
      `#Trading #QuantitativeAnalysis #StockMarket #BreakoutTrading`
    );
  },
  discord: (s: ShareTrigger) => {
    const returnStr = s.returnPct >= 0 ? `+${s.returnPct.toFixed(1)}%` : `${s.returnPct.toFixed(1)}%`;
    return (
      `**${s.symbol}** hit **${s.hitType}** → **${returnStr}**\n` +
      `Score: ${s.score}/100 (${s.grade}) | R/R ${s.riskReward.toFixed(1)}:1\n` +
      `Entry: $${s.entryPrice.toFixed(2)} → $${s.hitPrice.toFixed(2)} | ${s.heldDays}d hold`
    );
  },
};
