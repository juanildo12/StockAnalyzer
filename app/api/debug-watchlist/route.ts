import { NextResponse } from 'next/server';
import { getWatchlistFromFirestore, getAlertedSymbols, getAllWatchlistUsers } from '@/src/services/firebase';

export async function GET() {
  try {
    const userId = 'jferrerasdiaz_gmail_com';
    const watchlist = await getWatchlistFromFirestore(userId);
    const alerted = await getAlertedSymbols(userId);
    const allUsers = await getAllWatchlistUsers();
    
    return NextResponse.json({ 
      userId,
      watchlist,
      alertedSymbols: alerted,
      watchlistCount: watchlist.length,
      allUsersFound: allUsers.length,
      allUsers
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
