import { NextRequest, NextResponse } from 'next/server';
import type { SignalAction, VerifyResponse } from '@/src/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userGuess, confidence }: { userGuess: SignalAction; confidence: 'baja' | 'media' | 'alta' } = body;

    if (!userGuess || !['COMPRAR', 'MANTENER', 'VENDER'].includes(userGuess)) {
      return NextResponse.json({ error: 'Invalid guess' }, { status: 400 });
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/daily_signal=([^;]+)/);
    if (!match) {
      return NextResponse.json({ error: 'No active challenge. Fetch a daily challenge first.' }, { status: 400 });
    }

    const correctSignal = match[1] as SignalAction;
    const correct = userGuess === correctSignal;

    let baseScore = 0;
    if (correct) {
      baseScore = 60;
      if (confidence === 'alta') baseScore = 100;
      else if (confidence === 'media') baseScore = 80;
    } else {
      if (confidence === 'alta') baseScore = 10;
      else if (confidence === 'media') baseScore = 20;
      else baseScore = 30;
    }

    const explanation = correct
      ? `¡Correcto! El motor de señales también indica ${userGuess}. Coincidiste con el análisis fundamental, técnico y de analistas.`
      : `El motor de señales indica ${correctSignal}, no ${userGuess}. Revisa los datos mostrados para entender la discrepancia.`;

    const response: VerifyResponse = {
      correct,
      userGuess,
      correctSignal,
      score: baseScore,
      totalScore: baseScore,
      streak: correct ? 1 : 0,
      explanation,
    };

    const res = NextResponse.json(response, { status: 200 });
    res.headers.set('Set-Cookie', 'daily_signal=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
