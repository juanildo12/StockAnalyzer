import { NextResponse } from 'next/server';
import { getWatchlistFromFirestore, getAlertedSymbols, clearAlertedSymbol } from '@/src/services/firebase';

export async function GET() {
  try {
    const userId = 'jferrerasdiaz@gmail.com';
    const watchlist = await getWatchlistFromFirestore(userId);
    const alerted = await getAlertedSymbols(userId);
    
    return NextResponse.json({
      userId,
      watchlist,
      alertedSymbols: alerted,
      watchlistWithAlertDetails: watchlist.map(w => ({
        symbol: w.symbol,
        alertEnabled: w.alertEnabled,
        alertPrice: w.alertPrice,
        alertType: w.alertType,
        shouldTrigger: w.alertPrice && w.alertType === 'above' ? `${w.symbol} triggers when >= $${w.alertPrice}` : w.alertPrice && w.alertType === 'below' ? `${w.symbol} triggers when <= $${w.alertPrice}` : 'no price set'
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = 'jferrerasdiaz@gmail.com';
    const alerted = await getAlertedSymbols(userId);
    for (const symbol of alerted) {
      await clearAlertedSymbol(userId, symbol);
    }
    return NextResponse.json({ message: 'Cleared all alerted symbols', count: alerted.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
