import { prisma } from "@/src/lib/prisma";

export async function getWatchlist(userId: string) {
  return prisma.watchlists.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addToWatchlist(
  userId: string,
  symbol: string,
  alertPrice?: number,
  alertType?: string
) {
  return prisma.watchlists.upsert({
    where: { userId_symbol: { userId, symbol: symbol.toUpperCase() } },
    update: {
      alertPrice: alertPrice ?? undefined,
      alertType: alertType ?? "above",
    },
    create: {
      userId,
      symbol: symbol.toUpperCase(),
      alertPrice: alertPrice ?? undefined,
      alertType: alertType ?? "above",
    },
  });
}

export async function removeFromWatchlist(userId: string, symbol: string) {
  return prisma.watchlists.deleteMany({
    where: { userId, symbol: symbol.toUpperCase() },
  });
}

export async function updateWatchlistItem(
  userId: string,
  symbol: string,
  data: { alertPrice?: number; alertType?: string; notes?: string }
) {
  return prisma.watchlists.updateMany({
    where: { userId, symbol: symbol.toUpperCase() },
    data,
  });
}
