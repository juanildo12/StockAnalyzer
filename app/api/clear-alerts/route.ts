import { NextResponse } from 'next/server';
import { getAlertedSymbols, clearAlertedSymbol } from '@/src/services/firebase';

export async function GET() {
  try {
    const userId = 'jferrerasdiaz_gmail_com';
    const alerted = await getAlertedSymbols(userId);
    
    // Clear all alerted symbols
    for (const symbol of alerted) {
      await clearAlertedSymbol(userId, symbol);
    }
    
    return NextResponse.json({ 
      message: 'Alerted symbols cleared',
      previousAlerted: alerted,
      count: alerted.length
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
