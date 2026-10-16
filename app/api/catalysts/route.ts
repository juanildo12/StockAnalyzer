import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import {
  getEarningsCalendar,
  getEarningsCalendarChunked,
  getIPOCalendar,
  getEconomicCalendar,
  getCompanyNews,
  getGeneralNews,
  getRecommendationTrends,
} from '@/src/services/finnhubClient';
import { cacheAside, cacheGet, cacheSet } from '@/src/lib/cache';
import {
  getMassiveNews,
  getMassiveIPOs,
  getMassiveMarketHolidays,
  getMassiveDividends,
  getMassiveSplits,
  type NormalizedIPO,
  type NormalizedDividend,
  type NormalizedSplit,
} from '@/src/services/massiveClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const CACHE_TTL = 1800; // 30 min

interface Catalyst {
  type: 'earnings' | 'dividend' | 'ipo' | 'economic' | 'analyst' | 'news' | 'split' | 'holiday';
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

/** Códigos MIC de Massive → etiqueta legible. */
const EXCHANGE_LABELS: Record<string, string> = {
  XNYS: 'NYSE', XNAS: 'NASDAQ', XASE: 'AMEX', ARCA: 'ARCA', BATS: 'BATS',
};
function exchangeLabel(code?: string): string {
  if (!code) return '';
  return EXCHANGE_LABELS[code] || code;
}

function fmtCompact(n: number): string {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
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
  if (type === 'holiday') return 80;
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
  newsSentiment: NewsSentiment | null;
  analysts: any[] | null;
  macro: Catalyst[];
  generatedAt: number;
}

interface NewsSentiment {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  net: number; // (positive - negative) / total, -1..1
}

/** Agrega el sentiment que Massive entrega por artículo (positive/negative/neutral). */
function aggregateSentiment(news: any[]): NewsSentiment | null {
  const tagged = news.filter((n) => typeof n?.sentiment === 'string' && n.sentiment.length > 0);
  if (tagged.length === 0) return null;
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  for (const n of tagged) {
    if (n.sentiment === 'positive') positive++;
    else if (n.sentiment === 'negative') negative++;
    else neutral++;
  }
  const total = tagged.length;
  return { positive, negative, neutral, total, net: Math.round(((positive - negative) / total) * 100) / 100 };
}

async function fetchStockRoadmap(symbol: string): Promise<StockRoadmap | null> {
  const sym = symbol.toUpperCase();
  const key = `catalysts:stock:${sym}`;
  const cached = await cacheGet<StockRoadmap>(key);
  if (cached) return cached;

  const now = new Date();
  const to = addDays(now, 45);

  const [quoteSummary, finnEarnings, massiveNews, finnNews, reco, massiveDividends, massiveSplits] = await Promise.all([
    yf.quoteSummary(sym, { modules: ['calendarEvents', 'price'] }).catch(() => null),
    getEarningsCalendar(fmtDay(now), fmtDay(to)).catch(() => []),
    getMassiveNews({ ticker: sym, limit: 8 }).catch(() => []),
    getCompanyNews(sym, fmtDay(addDays(now, -7)), fmtDay(now)).catch(() => []),
    getRecommendationTrends(sym).catch(() => []),
    getMassiveDividends(sym, 12).catch(() => [] as NormalizedDividend[]),
    getMassiveSplits(sym, 5).catch(() => [] as NormalizedSplit[]),
  ]);

  // Massive news (con sentiment) primero; Finnhub como respaldo
  const news = massiveNews.length > 0 ? massiveNews : finnNews;

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

  // ── Dividendos próximos (Massive) — completa lo que Yahoo no trae ──
  const divSeen = new Set(upcoming.filter((c) => c.type === 'dividend').map((c) => c.date));
  for (const d of (massiveDividends as NormalizedDividend[])) {
    if (!d.exDividendDate || d.exDividendDate < fmtDay(now) || divSeen.has(d.exDividendDate)) continue;
    divSeen.add(d.exDividendDate);
    upcoming.push({
      type: 'dividend',
      title: `Ex-dividendo $${d.cashAmount.toFixed(2)}`,
      description: `Las acciones pierden derecho a cobrar el dividendo a partir de esta fecha${d.payDate ? ` · pago ${d.payDate}` : ''}`,
      date: d.exDividendDate,
      importance: importanceFor('dividend'),
      confidence: 90,
      status: 'Confirmado',
      source: 'Massive',
      emoji: '💵',
      meta: { cashAmount: d.cashAmount, payDate: d.payDate, frequency: d.frequency },
    });
  }

  // ── Splits programados (Massive) ──
  for (const s of (massiveSplits as NormalizedSplit[])) {
    if (!s.executionDate || s.executionDate < fmtDay(now)) continue;
    upcoming.push({
      type: 'split',
      title: `Split ${s.splitFrom}:${s.splitTo}`,
      description: `Desdoblamiento de acciones programado${s.adjustmentType ? ` (${s.adjustmentType})` : ''}`,
      date: s.executionDate,
      importance: 55,
      confidence: 85,
      status: 'Confirmado',
      source: 'Massive',
      emoji: '✂️',
      meta: {},
    });
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
    newsSentiment: aggregateSentiment(news as any[]),
    analysts: Array.isArray(reco) && reco.length > 0 ? reco.slice(0, 4) : null,
    macro,
    generatedAt: Date.now(),
  };

  cacheSet(key, result, CACHE_TTL).catch(() => {});
  return result;
}

interface CalendarRange {
  from: Date;
  to: Date;
  includePast: boolean;
  cap?: number;
}

const CALENDAR_DAY_CAP = 6;

async function fetchMarketCalendar(
  range: CalendarRange
): Promise<{ days: { iso: string; label: string; total: number; events: Catalyst[] }[]; start: string; end: string }> {
  const { from, to, includePast } = range;
  const fromIso = fmtDay(from);
  const toIso = fmtDay(to);

  const [earnings, ipo, economic, massiveGeneralNews, finnGeneralNews, massiveIpos, holidays] = await Promise.all([
    getEarningsCalendarChunked(fromIso, toIso).catch(() => []),
    getIPOCalendar(fromIso, toIso).catch(() => []),
    getEconomicCalendar().catch(() => []),
    getMassiveNews({ limit: 20 }).catch(() => []),
    getGeneralNews().catch(() => []),
    getMassiveIPOs({ from: fromIso, to: toIso, limit: 100 }).catch(() => [] as NormalizedIPO[]),
    getMassiveMarketHolidays().catch(() => []),
  ]);

  // Massive news primero (con sentiment); Finnhub como respaldo
  const generalNews = massiveGeneralNews.length > 0 ? massiveGeneralNews : finnGeneralNews;

  const today = fmtDay(new Date());
  const daysMap = new Map<string, Catalyst[]>();

  const push = (iso: string, c: Catalyst) => {
    if (iso < fromIso || iso > toIso) return;
    if (!includePast && iso < today) return;
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

  // IPO — Massive (free tier, oficial) primero; Finnhub sólo lo que Massive no traiga
  const ipoSeen = new Set<string>();
  for (const i of (massiveIpos as NormalizedIPO[])) {
    if (!i.listingDate || !i.ticker) continue;
    ipoSeen.add(`${i.ticker}:${i.listingDate}`);
    const priced =
      i.finalIssuePrice != null
        ? `$${i.finalIssuePrice}`
        : i.lowestOfferPrice != null && i.highestOfferPrice != null
          ? i.lowestOfferPrice === i.highestOfferPrice
            ? `$${i.lowestOfferPrice}`
            : `$${i.lowestOfferPrice}–$${i.highestOfferPrice}`
          : 'precio por definir';
    push(i.listingDate, {
      type: 'ipo',
      title: `IPO: ${i.issuerName || i.ticker}${i.primaryExchange ? ` (${exchangeLabel(i.primaryExchange)})` : ''}`,
      description: `${i.ticker} · Precio ${priced}${i.sharesOutstanding ? ` · ${fmtCompact(i.sharesOutstanding)} acciones` : ''}`,
      date: i.listingDate,
      importance: importanceFor('ipo'),
      confidence: i.ipoStatus === 'new' ? 90 : 75,
      status: i.ipoStatus === 'new' ? 'Confirmado' : 'Esperado',
      source: 'Massive',
      emoji: '🚀',
      meta: { symbol: i.ticker, exchange: exchangeLabel(i.primaryExchange), issuePrice: i.finalIssuePrice },
    });
  }
  for (const i of (ipo as any[])) {
    if (!i.date) continue;
    if (ipoSeen.has(`${i.symbol}:${i.date}`)) continue;
    push(i.date, {
      type: 'ipo',
      title: `IPO: ${i.name || i.symbol}${i.exchange ? ` (${i.exchange})` : ''}`,
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

  // Festivos de mercado (Massive) — NYSE/NASDAQ duplican, así que un chip por día
  const holidayByDate = new Map<string, { name: string; status: string }>();
  for (const h of (holidays as any[])) {
    if (!h?.date || !h?.exchange) continue;
    if (h.exchange !== 'NYSE' && h.exchange !== 'NASDAQ') continue;
    if (!holidayByDate.has(h.date)) holidayByDate.set(h.date, { name: h.name || 'Festivo', status: h.status || 'closed' });
  }
  for (const [date, info] of Array.from(holidayByDate.entries())) {
    const early = info.status === 'early-close';
    push(date, {
      type: 'holiday',
      title: `${early ? 'Cierre temprano' : 'Mercado cerrado'} · ${info.name}`,
      description: early ? 'La bolsa cierra temprano ese día (sesión reducida)' : 'Bolsa de valores cerrada; sin sesión',
      date,
      importance: importanceFor('holiday'),
      confidence: 100,
      status: 'Confirmado',
      source: 'Massive',
      emoji: '🏖️',
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
    if (iso < fromIso || iso > toIso) continue;
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
      meta: { sentiment: n.sentiment ?? null },
    });
  }

  // Un mes de calendario trae ~1.500 eventos (solo un día puede tener 300+).
  // La rejilla no cabe con eso, así que recortamos por celda y exponemos
  // `total` para que la UI diga "+N más" sin mentir. Un rango de un solo día
  // no se recorta: es la petición que hace la celda al desplegarse.
  const cap = range.cap ?? Number.POSITIVE_INFINITY;

  const days = Array.from(daysMap.keys())
    .sort()
    .map(iso => {
      const events = daysMap.get(iso)!.sort((a, b) => b.importance - a.importance);
      return { iso, label: iso === today ? 'Hoy' : dayLabel(iso), total: events.length, events: events.slice(0, cap) };
    });

  return { days, start: fromIso, end: toIso };
}

/**
 * Tres modos:
 *  - `day=YYYY-MM-DD`  → un único día, sin recortar (lo pide una celda al desplegarse)
 *  - `start=YYYY-MM`   → mes(es) completo(s), recortado por celda para la rejilla
 *  - sin params        → la vista semanal de siempre (hoy + 7 días)
 */
function resolveRange(start: string | null, months: number, day: string | null): CalendarRange {
  const now = new Date();

  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const d = new Date(`${day}T00:00:00Z`);
    return { from: d, to: d, includePast: true };
  }

  if (!start || !/^\d{4}-\d{2}(-\d{2})?$/.test(start)) {
    return { from: addDays(now, -1), to: addDays(now, 7), includePast: false };
  }

  const span = Math.min(Math.max(Math.round(months) || 1, 1), 3);
  const [y, m] = start.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m - 1 + span, 0));
  return { from, to, includePast: true, cap: CALENDAR_DAY_CAP };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const start = request.nextUrl.searchParams.get('start');
  const day = request.nextUrl.searchParams.get('day');
  const months = Number(request.nextUrl.searchParams.get('months') || 1);

  try {
    if (symbol && symbol.trim()) {
      const roadmap = await fetchStockRoadmap(symbol.trim().toUpperCase());
      if (!roadmap) {
        return NextResponse.json({ error: 'No se pudo obtener catalizadores para este símbolo' }, { status: 404 });
      }
      return NextResponse.json(roadmap);
    }

    const range = resolveRange(start, months, day);
    const key = `catalysts:cal:${fmtDay(range.from)}:${fmtDay(range.to)}`;
    const calendar = await cacheAside(key, CACHE_TTL, () => fetchMarketCalendar(range));
    return NextResponse.json(calendar);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}