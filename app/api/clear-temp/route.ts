import { NextResponse } from 'next/server';
import { getAlertedSymbols, clearAlertedSymbol } from '@/src/services/firebase';

export async function GET() {
  try {
    const userId = 'jferrerasdiaz@gmail.com';
    const alerted = await getAlertedSymbols(userId);
    
    return NextResponse.json({
      userId,
      currentAlertedSymbols: alerted
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
    
    return NextResponse.json({
      message: 'All alerted symbols cleared',
      cleared: alerted
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
