import { saveWatchlistToFirestore } from "@/src/services/firebase";
import { prisma } from "@/src/lib/prisma";

/**
 * Write watchlist to both Firestore and PostgreSQL.
 * PostgreSQL is the source of truth for reads.
 * Firestore is kept for mobile app compatibility.
 */
export async function dualWriteWatchlist(
  userId: string,
  email: string,
  watchlist: Array<{ symbol: string; alertPrice?: number; alertType?: string }>
) {
  // Write to PostgreSQL (source of truth)
  for (const item of watchlist) {
    await prisma.watchlists.upsert({
      where: {
        userId_symbol: { userId, symbol: item.symbol.toUpperCase() },
      },
      update: {
        alertPrice: item.alertPrice,
        alertType: item.alertType ?? "above",
      },
      create: {
        userId,
        symbol: item.symbol.toUpperCase(),
        alertPrice: item.alertPrice,
        alertType: item.alertType ?? "above",
      },
    });
  }

  // Write to Firestore (legacy/mobile compatibility)
  await saveWatchlistToFirestore(email, watchlist);
}
