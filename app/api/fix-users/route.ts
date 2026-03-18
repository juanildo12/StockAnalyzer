import { NextResponse } from 'next/server';
import { getWatchlistFromFirestore, saveWatchlistToFirestore, getAlertedSymbols, clearAlertedSymbol } from '@/src/services/firebase';

export async function GET() {
  try {
    const correctUserId = 'jferrerasdiaz@gmail.com';
    const wrongUserId = 'jferrerasdiaz_gmail_com';
    
    // Get data from both
    const correctWatchlist = await getWatchlistFromFirestore(correctUserId);
    const wrongWatchlist = await getWatchlistFromFirestore(wrongUserId);
    const correctAlerted = await getAlertedSymbols(correctUserId);
    const wrongAlerted = await getAlertedSymbols(wrongUserId);
    
    // Merge watchlists (combine both)
    const mergedWatchlist = [...correctWatchlist];
    for (const item of wrongWatchlist) {
      if (!mergedWatchlist.some(w => w.symbol === item.symbol)) {
        mergedWatchlist.push(item);
      }
    }
    
    // Save merged watchlist to correct user
    if (mergedWatchlist.length > 0) {
      await saveWatchlistToFirestore(correctUserId, mergedWatchlist);
    }
    
    // Merge alerted symbols
    const allAlerted = [...correctAlerted, ...wrongAlerted];
    const mergedAlerted = allAlerted.filter((item, index) => allAlerted.indexOf(item) === index);
    
    // Clear wrong alerted
    for (const symbol of wrongAlerted) {
      await clearAlertedSymbol(wrongUserId, symbol);
    }
    
    return NextResponse.json({
      correctWatchlist: correctWatchlist.length,
      wrongWatchlist: wrongWatchlist.length,
      mergedWatchlist: mergedWatchlist.length,
      mergedSymbols: mergedWatchlist.map(w => w.symbol),
      alertedBefore: { correct: correctAlerted, wrong: wrongAlerted }
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
