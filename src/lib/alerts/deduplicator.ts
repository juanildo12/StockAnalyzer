import { prisma } from "@/src/lib/prisma";

export async function wasRecentlyAlerted(symbol: string, userId: string): Promise<boolean> {
  const existing = await prisma.smart_alerts.findFirst({
    where: {
      symbol: symbol.toUpperCase(),
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return !!existing;
}

export async function markAlerted(alertId: string): Promise<void> {
  await prisma.smart_alerts.update({
    where: { id: alertId },
    data: { status: "active" },
  });
}

export async function expireOldAlerts(): Promise<number> {
  const result = await prisma.smart_alerts.updateMany({
    where: {
      status: "active",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });

  return result.count;
}
