import { prisma } from "@/src/lib/prisma";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export interface SignalRecord {
  symbol: string;
  signalType: string;
  score: number;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
}

export async function logSignal(signal: SignalRecord): Promise<void> {
  await prisma.signal_history.create({
    data: {
      symbol: signal.symbol,
      signalType: signal.signalType,
      score: signal.score,
      entryPrice: signal.entryPrice,
      targetPrice: signal.targetPrice,
      stopPrice: signal.stopPrice,
      outcome: "pending",
    },
  });
}

export async function evaluatePendingSignals(): Promise<{
  evaluated: number;
  wins: number;
  losses: number;
}> {
  const startTime = Date.now();
  let wins = 0;
  let losses = 0;

  // Get pending signals older than 1 day (give them time to play out)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const pendingSignals = await prisma.signal_history.findMany({
    where: {
      outcome: "pending",
      createdAt: { lte: oneDayAgo },
    },
    take: 50,
  });

  if (pendingSignals.length === 0) {
    return { evaluated: 0, wins: 0, losses: 0 };
  }

  // Get unique symbols
  const symbols = [...new Set(pendingSignals.map((s) => s.symbol))];

  // Fetch current prices
  const prices = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (sym) => {
        const q = await yf.quote(sym).catch(() => null);
        return { symbol: sym, price: q?.regularMarketPrice || null };
      })
    );
    results.forEach((r) => {
      if (r.price !== null) prices.set(r.symbol, r.price);
    });
  }

  // Evaluate each signal
  for (const signal of pendingSignals) {
    const currentPrice = prices.get(signal.symbol);
    if (currentPrice === undefined) continue;

    const entry = Number(signal.entryPrice);
    const target = Number(signal.targetPrice);
    const stop = Number(signal.stopPrice);

    let outcome: string;
    let outcomePrice: number;

    if (signal.signalType === "BUY" || signal.signalType === "BREAKOUT") {
      // Long signal: win if hit target, loss if hit stop
      if (currentPrice >= target) {
        outcome = "win";
        outcomePrice = target;
        wins++;
      } else if (currentPrice <= stop) {
        outcome = "loss";
        outcomePrice = stop;
        losses++;
      } else {
        // Still playing out — skip
        continue;
      }
    } else {
      // SELL signal
      if (currentPrice <= target) {
        outcome = "win";
        outcomePrice = target;
        wins++;
      } else if (currentPrice >= stop) {
        outcome = "loss";
        outcomePrice = stop;
        losses++;
      } else {
        continue;
      }
    }

    await prisma.signal_history.update({
      where: { id: signal.id },
      data: {
        outcome,
        outcomePrice,
        outcomeDate: new Date(),
      },
    });
  }

  const evaluated = wins + losses;

  await prisma.job_runs.create({
    data: {
      jobType: "evaluate-signals",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        evaluated,
        wins,
        losses,
        winRate: evaluated > 0 ? Math.round((wins / evaluated) * 100) : 0,
        durationMs: Date.now() - startTime,
      },
    },
  });

  return { evaluated, wins, losses };
}

export async function getSignalStats(): Promise<{
  totalSignals: number;
  pending: number;
  wins: number;
  losses: number;
  winRate: number;
  avgScore: number;
  byType: Record<string, { count: number; winRate: number }>;
}> {
  const stats = await prisma.signal_history.groupBy({
    by: ["outcome"],
    _count: { id: true },
  });

  const total = stats.reduce((sum, s) => sum + s._count.id, 0);
  const pending = stats.find((s) => s.outcome === "pending")?._count.id || 0;
  const wins = stats.find((s) => s.outcome === "win")?._count.id || 0;
  losses = stats.find((s) => s.outcome === "loss")?._count.id || 0;

  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  // Average score
  const avgResult = await prisma.signal_history.aggregate({
    _avg: { score: true },
    where: { outcome: { not: "pending" } },
  });

  // By type
  const byTypeRaw = await prisma.signal_history.groupBy({
    by: ["signalType", "outcome"],
    _count: { id: true },
  });

  const byType: Record<string, { count: number; winRate: number }> = {};
  const typeMap = new Map<string, { total: number; wins: number }>();

  for (const row of byTypeRaw) {
    const current = typeMap.get(row.signalType) || { total: 0, wins: 0 };
    current.total += row._count.id;
    if (row.outcome === "win") current.wins += row._count.id;
    typeMap.set(row.signalType, current);
  }

  for (const [type, data] of typeMap) {
    byType[type] = {
      count: data.total,
      winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0,
    };
  }

  return {
    totalSignals: total,
    pending,
    wins,
    losses,
    winRate,
    avgScore: Math.round(avgResult._avg.score || 0),
    byType,
  };
}
