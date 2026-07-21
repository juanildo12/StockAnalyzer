import { prisma } from "@/src/lib/prisma";
import { shareResult } from "./orchestrator";
import { ShareTrigger } from "./types";

interface TPHitResult {
  checked: number;
  shared: number;
  errors: string[];
}

export async function detectTPHits(): Promise<TPHitResult> {
  const result: TPHitResult = { checked: 0, shared: 0, errors: [] };

  // Find active smart alerts that haven't been shared yet
  const activeAlerts = await prisma.smart_alerts.findMany({
    where: {
      status: "active",
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (activeAlerts.length === 0) return result;

  // Get unique symbols
  const symbols = Array.from(new Set(activeAlerts.map(a => a.symbol)));

  // Fetch current prices (batch)
  const YahooFinance = (await import("yahoo-finance2")).default;
  const yf = new YahooFinance();
  const prices = new Map<string, number>();

  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (sym) => {
        const q = await yf.quote(sym).catch(() => null) as any;
        return { symbol: sym, price: q?.regularMarketPrice || null };
      })
    );
    results.forEach(r => {
      if (r.price !== null) prices.set(r.symbol, r.price);
    });
  }

  // Check each alert
  for (const alert of activeAlerts) {
    try {
      result.checked++;

      const currentPrice = prices.get(alert.symbol);
      if (currentPrice === undefined) continue;

      const entry = Number(alert.entry);
      const tp1 = Number(alert.tp1);
      const tp2 = Number(alert.tp2);
      const stopLoss = Number(alert.stopLoss);

      // Check for TP1 or TP2 hit
      let hitType: "TP1" | "TP2" | null = null;
      let hitPrice = 0;

      if (currentPrice >= tp2) {
        hitType = "TP2";
        hitPrice = tp2;
      } else if (currentPrice >= tp1) {
        hitType = "TP1";
        hitPrice = tp1;
      }

      if (!hitType) continue;

      // Check if stop was hit first (loss)
      if (currentPrice <= stopLoss) continue;

      // Calculate return
      const returnPct = ((hitPrice - entry) / entry) * 100;

      // Calculate hold duration
      const heldDays = Math.max(1, Math.ceil(
        (Date.now() - alert.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      ));

      const trigger: ShareTrigger = {
        alertId: alert.id,
        symbol: alert.symbol,
        userId: alert.userId,
        score: alert.score,
        grade: alert.grade,
        entryPrice: entry,
        targetPrice: hitPrice,
        stopPrice: stopLoss,
        hitPrice,
        hitType,
        returnPct,
        heldDays,
        riskReward: Number(alert.riskReward),
      };

      // Share (respects dedup + rate limits)
      const shareResults = await shareResult(trigger, ["twitter", "linkedin", "discord"]);
      const anyShared = shareResults.some(r => r.success);
      if (anyShared) result.shared++;

      // Mark alert as triggered
      await prisma.smart_alerts.update({
        where: { id: alert.id },
        data: { status: "triggered" },
      });

    } catch (error) {
      result.errors.push(`${alert.symbol}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return result;
}
