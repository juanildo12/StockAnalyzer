import { prisma } from "@/src/lib/prisma";

export async function canSendAlert(userId: string, symbol: string): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // 1. Check user daily limit
  const userAlertsToday = await prisma.smart_alerts.count({
    where: {
      userId,
      createdAt: { gte: todayStart },
      status: { in: ["active", "triggered"] },
    },
  });

  if (userAlertsToday >= 3) {
    return { allowed: false, reason: `User daily limit reached (${userAlertsToday}/3)` };
  }

  // 2. Check same-ticker cooldown (24h)
  const recentForTicker = await prisma.smart_alerts.findFirst({
    where: {
      userId,
      symbol: symbol.toUpperCase(),
      createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      status: { in: ["active", "triggered"] },
    },
  });

  if (recentForTicker) {
    const hoursAgo = Math.round((now.getTime() - recentForTicker.createdAt.getTime()) / (60 * 60 * 1000));
    return { allowed: false, reason: `Same ticker alert ${hoursAgo}h ago (min 24h)` };
  }

  // 3. Check global daily limit
  const globalAlertsToday = await prisma.smart_alerts.count({
    where: {
      createdAt: { gte: todayStart },
      status: { in: ["active", "triggered"] },
    },
  });

  if (globalAlertsToday >= 50) {
    return { allowed: false, reason: `Global daily limit reached (${globalAlertsToday}/50)` };
  }

  return { allowed: true };
}

export async function isMarketOpen(): Promise<boolean> {
  const now = new Date();

  // Convert to ET (UTC-4 or UTC-5 depending on DST)
  const etOffset = -4; // Simplified; use proper DST check in production
  const etHour = (now.getUTCHours() + etOffset + 24) % 24;
  const etMin = now.getUTCMinutes();
  const etTime = etHour * 60 + etMin;

  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false; // Weekend

  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return etTime >= marketOpen && etTime <= marketClose;
}
