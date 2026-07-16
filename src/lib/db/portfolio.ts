import { prisma } from "@/src/lib/prisma";

export async function getPortfolio(userId: string) {
  return prisma.portfolios.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addPortfolioItem(
  userId: string,
  data: { symbol: string; shares: number; purchasePrice: number; purchaseDate?: Date; notes?: string }
) {
  return prisma.portfolios.create({
    data: {
      userId,
      symbol: data.symbol.toUpperCase(),
      shares: data.shares,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.purchaseDate,
      notes: data.notes,
    },
  });
}

export async function updatePortfolioItem(
  userId: string,
  id: string,
  data: { shares?: number; purchasePrice?: number; notes?: string }
) {
  return prisma.portfolios.updateMany({
    where: { id, userId },
    data,
  });
}

export async function removePortfolioItem(userId: string, id: string) {
  return prisma.portfolios.deleteMany({
    where: { id, userId },
  });
}
