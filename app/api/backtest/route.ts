import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { runBacktest, STRATEGIES } from '@/src/services/backtest';
import { PLAN_RANK } from '@/src/lib/navigation/profiles';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_SYMBOLS = 8;
const MAX_YEARS = 5;

const VALID_STRATEGIES = new Set(STRATEGIES.map((s) => s.id));

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const plan = String((session.user as any).plan || 'free').toLowerCase();
  if ((PLAN_RANK[plan] ?? 0) < (PLAN_RANK.pro ?? 1)) {
    return NextResponse.json(
      {
        error: 'Subscription required',
        required: 'pro',
        current: plan,
        upgradeUrl: '/settings/billing',
        message: 'El backtest engine es una función PRO.',
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const symbols: string[] = Array.isArray(body.symbols)
      ? body.symbols.map((s: unknown) => String(s).trim().toUpperCase()).filter(Boolean)
      : [];
    const invalid = symbols.filter((s) => !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Símbolos no válidos: ${invalid.join(', ')}` }, { status: 400 });
    }
    if (symbols.length === 0) {
      return NextResponse.json({ error: 'Indica al menos un símbolo.' }, { status: 400 });
    }
    if (symbols.length > MAX_SYMBOLS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_SYMBOLS} símbolos por backtest.` },
        { status: 400 },
      );
    }

    const startDate = String(body.startDate || '').slice(0, 10);
    const endDate = String(body.endDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json({ error: 'Fechas inválidas (formato YYYY-MM-DD).' }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio.' }, { status: 400 });
    }
    const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 86400000);
    if (years > MAX_YEARS) {
      return NextResponse.json({ error: `El periodo máximo es de ${MAX_YEARS} años.` }, { status: 400 });
    }

    const strategy = String(body.strategy || 'trend');
    if (!VALID_STRATEGIES.has(strategy as any)) {
      return NextResponse.json({ error: `Estrategia no válida: ${strategy}` }, { status: 400 });
    }

    const result = await runBacktest({
      symbols,
      startDate,
      endDate,
      initialCash: Number(body.initialCash) || 100000,
      strategy: strategy as any,
      commissionBps: body.commissionBps === undefined ? 5 : Number(body.commissionBps),
      slippageBps: body.slippageBps === undefined ? 5 : Number(body.slippageBps),
      benchmark: body.benchmark || 'SPY',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[backtest] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Backtest failed' },
      { status: 500 },
    );
  }
}
