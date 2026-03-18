import { NextResponse } from 'next/server';
import { getWatchlistFromFirestore, WatchlistItem, getAlertedSymbols, clearAlertedSymbol, saveWatchlistToFirestore } from '@/src/services/firebase';

export async function GET() {
  try {
    const userId = 'jferrerasdiaz_gmail_com';
    
    // Get current watchlist
    const watchlist = await getWatchlistFromFirestore(userId);
    const alertedSymbols = await getAlertedSymbols(userId);
    
    // Get symbols from watchlist
    const watchlistSymbols = watchlist.map(w => w.symbol);
    
    // Find alerted symbols that are NOT in watchlist
    const invalidAlerted = alertedSymbols.filter(s => !watchlistSymbols.includes(s));
    
    // Clear invalid alerted symbols
    for (const symbol of invalidAlerted) {
      await clearAlertedSymbol(userId, symbol);
    }
    
    return NextResponse.json({ 
      message: 'Cleanup completed',
      watchlistSymbols,
      clearedAlertedSymbols: invalidAlerted
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = 'jferrerasdiaz_gmail_com';
    
    // Clear the entire watchlist
    await saveWatchlistToFirestore(userId, []);
    
    return NextResponse.json({ 
      message: 'Watchlist cleared'
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
