import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import {
  getEarningsCalendar,
  getIPOCalendar,
  getEconomicCalendar,
  getCompanyNews,
  getGeneralNews,
  getRecommendationTrends,
} from '@/src/services/finnhubClient';
import { cacheGet, cacheSet } from '@/src/lib/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const CACHE_TTL = 1800; // 30 min

interface Catalyst {
  type: 'earnings' | 'dividend' | 'ipo' | 'economic' | 'analyst' | 'news' | 'split';
  title: string;
  description?: string;
  date: string;
  importance: number;
  confidence: number;
  status: 'Confirmado' | 'Tentativo' | 'Esperado' | 'Rumor' | 'Completado';
  source: string;
  link?: string;
  emoji: string;
  meta?: Record<string, any>;
}

const KNOWN_MAJORS = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD',
  'NFLX', 'CRM', 'ORCL', 'PLTR', 'ADBE', 'QCOM', 'MU', 'UBER', 'COIN', 'SHOP',
  'DIS', 'NKE', 'JPM', 'GS', 'V', 'MA', 'LLY', 'UNH', 'BA', 'XOM', 'CAT', 'MRVL',
]);

function importanceFor(type: Catalyst['type'], symbol?: string): number {
  if (type === 'earnings') return symbol && KNOWN_MAJORS.has(symbol) ? 85 : 70;
  if (type === 'economic') return 75;
  if (type === 'ipo') return 60;
  if (type === 'analyst') return 50;
  if (type === 'dividend') return 35;
  return 30;
}

const fmtDay = (d: Date) => d.toISOString().split('T')[0];
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return `${DAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('es', { month: 'short' })}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

interface StockRoadmap {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  upcoming: Catalyst[];
  news: any[];
  analysts: any[] | null;
  macro: Catalyst[];
  generatedAt: number;
}

async function fetchStockRoadmap(symbol: string): Promise<StockRoadmap | null> {
  const sym = symbol.toUpperCase();
  const key = `catalysts:stock:${sym}`;
  const cached = await cacheGet<StockRoadmap>(key);
  if (cached) return cached;

  const now = new Date();
  const to = addDays(now, 45);

  const [quoteSummary, finnEarnings, news, reco] = await Promise.all([
    yf.quoteSummary(sym, { modules: ['calendarEvents', 'price'] }).catch(() => null),
    getEarningsCalendar(fmtDay(now), fmtDay(to)).catch(() => []),
    getCompanyNews(sym, fmtDay(addDays(now, -7)), fmtDay(now)).catch(() => []),
    getRecommendationTrends(sym).catch(() => []),
  ]);

  const calendar = quoteSummary?.calendarEvents as any;
  const price = quoteSummary?.price as any;
  const currentPrice = price?.regularMarketPrice || price?.postMarketPrice || 0;
  const changePct = price?.regularMarketChangePercent ?? 0;

  const upcoming: Catalyst[] = [];

  // ── Ganancias (Yahoo calendarEvents + estimados) ──
  if (calendar?.earnings?.earningsDate) {
    for (const d of calendar.earnings.earningsDate as any[]) {
      const day = new Date(d).toISOString().slice(0, 10);
      if (day < fmtDay(now)) continue;
      const eps = calendar.earnings.earningsAverage;
      const rev = calendar.earnings.revenueAverage;
      upcoming.push({
        type: 'earnings',
        title: `Reporta resultados (Q${calendar.earnings.quarter ?? '?'})`,
        description: calendar.earnings.isEarningsDateEstimate
          ? 'Fecha estimada de reporte trimestral'
          : eps
            ? `Consenso EPS estimado: $${eps.toFixed(2)} · Revenue: $${(rev / 1e9).toFixed(1)}B`
            : '',
        date: day,
        importance: importanceFor('earnings', sym),
        confidence: calendar.earnings.isEarningsDateEstimate ? 70 : 95,
        status: calendar.earnings.isEarningsDateEstimate ? 'Tentativo' : 'Confirmado',
        source: 'Yahoo Finance',
        emoji: '💰',
        meta: { epsEstimate: eps, revenueEstimate: rev },
      });
    }
  }

  // ── Fin de mes: estimado desde Finnhub si no lo dio Yahoo ──
  if (upcoming.filter(c => c.type === 'earnings').length === 0) {
    const row = finnEarnings.find((e: any) => e.symbol === sym && e.date >= fmtDay(now));
    if (row) {
      upcoming.push({
        type: 'earnings',
        title: `Reporta resultados (trimestre ~${row.quarter} ${row.year})`,
        description: row.epsEstimate ? `Consenso EPS estimado: $${row.epsEstimate.toFixed(2)}` : 'Fecha de reporte trimestral (fuente: Finnhub)',
        date: row.date,
        importance: importanceFor('earnings', sym),
        confidence: 90,
        status: 'Confirmado',
        source: 'Finnhub',
        emoji: '💰',
        meta: { epsEstimate: row.epsEstimate },
      });
    }
  }

  // ── Dividendos ──
  if (calendar?.exDividendDate) {
    const ex = new Date(calendar.exDividendDate).toISOString().slice(0, 10);
    if (ex >= fmtDay(now)) {
      upcoming.push({
        type: 'dividend',
        title: 'Fecha ex-dividendo',
        description: 'Acciones pierden derecho a cobrar el próximo dividendo a partir de esta fecha',
        date: ex,
        importance: importanceFor('dividend'),
        confidence: 92,
        status: 'Confirmado',
        source: 'Yahoo Finance',
        emoji: '💵',
        meta: { dividendDate: calendar.dividendDate ? new Date(calendar.dividendDate).toISOString().slice(0, 10) : null },
      });
    }
  }

  const sorted = upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const macro: Catalyst[] = [];

  const result: StockRoadmap = {
    symbol: sym,
    name: price?.longName || price?.shortName || sym,
    price: currentPrice,
    changePct,
    upcoming: sorted,
    news: (news as any[]).slice(0, 8),
    analysts: Array.isArray(reco) && reco.length > 0 ? reco.slice(0, 4) : null,
    macro,
    generatedAt: Date.now(),
  };

  cacheSet(key, result, CACHE_TTL).catch(() => {});
  return result;
}

async function fetchMarketCalendar(): Promise<{ days: { iso: string; label: string; events: Catalyst[] }[] }> {
  const now = new Date();
  const from = addDays(now, -1);
  const to = addDays(now, 7);

  const [earnings, ipo, economic, generalNews] = await Promise.all([
    getEarningsCalendar(fmtDay(from), fmtDay(to)).catch(() => []),
    getIPOCalendar(fmtDay(from), fmtDay(to)).catch(() => []),
    getEconomicCalendar().catch(() => []),
    getGeneralNews().catch(() => []),
  ]);

  const today = fmtDay(now);
  const daysMap = new Map<string, Catalyst[]>();

  const push = (iso: string, c: Catalyst) => {
    if (iso < today) return;
    if (!daysMap.has(iso)) daysMap.set(iso, []);
    daysMap.get(iso)!.push(c);
  };

  // Earnings
  for (const e of (earnings as any[])) {
    if (!e.date) continue;
    push(e.date, {
      type: 'earnings',
      title: `${e.symbol} reporta resultados`,
      description: e.epsEstimate ? `EPS est: $${e.epsEstimate.toFixed(2)}` : `Week ${e.week || ''} · ${e.quarter}Q${e.quarter ? '' : ''} ${e.year}`.trim(),
      date: e.date,
      importance: importanceFor('earnings', e.symbol),
      confidence: 90,
      status: 'Confirmado',
      source: 'Finnhub',
      emoji: '💰',
      meta: { symbol: e.symbol, hour: e.hour || '', epsEstimate: e.epsEstimate },
    });
  }

  // IPO
  for (const i of (ipo as any[])) {
    if (!i.date) continue;
    push(i.date, {
      type: 'ipo',
      title: `IPO: ${i.name || i.symbol} (${i.exchange || ''})`,
      description: `Precio: $${i.price} · ${i.numberOfShares ? `${(i.numberOfShares / 1e6).toFixed(0)}M acciones` : ''}`.trim(),
      date: i.date,
      importance: importanceFor('ipo'),
      confidence: i.status === 'expected' ? 75 : 90,
      status: i.status === 'expected' ? 'Esperado' : 'Confirmado',
      source: 'Finnhub',
      emoji: '🚀',
      meta: { symbol: i.symbol },
    });
  }

  // Economic (si el plan lo permite) — si no, los news cubren el hueco
  for (const e of (economic as any[])) {
    if (!e.date) continue;
    push(e.date, {
      type: 'economic',
      title: e.event || e.title || 'Evento económico',
      description: `${e.period || ''}${e.actual != null ? ` · Actual: ${e.actual}` : e.estimate != null ? ` · Est: ${e.estimate}` : ''}`,
      date: e.date,
      importance: importanceFor('economic'),
      confidence: 95,
      status: 'Confirmado',
      source: 'Finnhub Economic',
      emoji: '🌐',
    });
  }

  // General market news → background catalysts
  for (const n of (generalNews as any[])) {
    const dt = new Date(n.datetime * 1000);
    const iso = fmtDay(dt);
    if (iso < today || iso > fmtDay(to)) continue;
    push(iso, {
      type: 'news',
      title: n.headline,
      description: ((n.summary || '')).slice(0, 200),
      date: iso,
      importance: 30,
      confidence: 85,
      status: 'Confirmado',
      source: n.source || 'Market News',
      link: n.url,
      emoji: '📰',
    });
  }

  const days = Array.from(daysMap.keys())
    .sort()
    .map(iso => ({ iso, label: iso === today ? 'Hoy' : dayLabel(iso), events: daysMap.get(iso)!.sort((a, b) => b.importance - a.importance) }));

  // News = background; si hay muy pocos eventos un día, nada que hacer
  return { days };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');

  try {
    if (symbol && symbol.trim()) {
      const roadmap = await fetchStockRoadmap(symbol.trim().toUpperCase());
      if (!roadmap) {
        return NextResponse.json({ error: 'No se pudo obtener catalizadores para este símbolo' }, { status: 404 });
      }
      return NextResponse.json(roadmap);
    }
    const calendar = await fetchMarketCalendar();
    return NextResponse.json(calendar);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}