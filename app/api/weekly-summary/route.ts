import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet } from '@/src/lib/cache';
import { buildMarketPulse, type PulseSeries } from '@/src/lib/market/pulse';
import {
  buildWeeklySummary,
  getWeekContext,
  parseWeeklyAi,
  type WeeklyAiOutlook,
  type WeeklyEvent,
  type WeeklyPulse,
} from '@/src/lib/market/weeklySummary';
import { buildMarketPulsePayload, fetchPulseSeries } from '@/src/services/marketPulseService';
import { getEarningsCalendarChunked, getGeneralNews } from '@/src/services/finnhubClient';
import { getMassiveNews } from '@/src/services/massiveClient';
import { getEconomicEvents } from '@/src/services/tradingViewCalendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL = 86400;
const AI_MODEL = process.env.OPENROUTER_WEEKLY_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';

function pulseLite(payload: Awaited<ReturnType<typeof buildMarketPulsePayload>> | null): WeeklyPulse | null {
  if (!payload || payload.score == null) return null;
  const p5 = payload.probabilities?.find(p => p.horizon === 5) || null;
  return {
    score: payload.score,
    zone: payload.zone ?? null,
    delta5d: payload.delta5d ?? null,
    pUp5d: p5?.pUp ?? null,
    ciLow: p5?.ci95?.[0] ?? null,
    ciHigh: p5?.ci95?.[1] ?? null,
    baselinePUp: p5?.baselinePUp ?? null,
    edgePp: p5?.edgePp ?? null,
  };
}

async function fetchEvents(start: string, end: string): Promise<WeeklyEvent[]> {
  const results = await Promise.allSettled([
    getEconomicEvents(start, end, { minImportance: 0 }),
    getEarningsCalendarChunked(start, end),
  ]);
  const events: WeeklyEvent[] = [];

  const macro = results[0].status === 'fulfilled' ? results[0].value : [];
  for (const ev of macro) {
    if (!ev?.date || !ev?.title) continue;
    const importance = ev.importanceLabel === 'high' ? 90 : ev.importanceLabel === 'medium' ? 68 : 45;
    events.push({
      iso: String(ev.date).slice(0, 10),
      title: String(ev.title),
      type: 'economic',
      importance,
      emoji: '🌐',
    });
  }

  const earnings = results[1].status === 'fulfilled' ? results[1].value : [];
  for (const ev of earnings) {
    if (!ev?.date || !ev?.symbol) continue;
    events.push({
      iso: String(ev.date).slice(0, 10),
      title: `Resultados de ${ev.symbol}`,
      type: 'earnings',
      importance: 82,
      emoji: '📊',
      symbol: String(ev.symbol),
    });
  }

  const seen = new Set<string>();
  return events.filter(e => {
    const k = `${e.iso}:${e.type}:${e.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function askAi(payload: any): Promise<WeeklyAiOutlook | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const compact = {
    week: payload.weekKey,
    nextWeek: payload.nextWeek.label,
    indices: payload.indices.map((i: any) => ({ symbol: i.symbol, close: i.close, ret: i.weeklyReturnPct })),
    pulse: payload.pulse && {
      score: payload.pulse.score, zone: payload.pulse.zone,
      pUp5d: payload.pulse.pUp5d, edgePp: payload.pulse.edgePp,
    },
    news: payload.newsSentiment && { net: payload.newsSentiment.net, total: payload.newsSentiment.total },
    events: payload.events.slice(0, 8).map((e: any) => ({
      iso: e.iso, title: e.title, importance: e.importance,
    })),
    deterministicBias: payload.outlook.bias,
  };
  const system = [
    'Eres un analista de mercado conciso. Solo usas los datos entregados en JSON.',
    'No inventes cifras, eventos ni noticias. No des consejos de inversión personalizados.',
    'Devuelve SOLO JSON válido con: {"headline":"...","bias":"bullish|bearish|neutral","scenarios":[{"label":"Base|Alcista|Bajista","text":"..."}],"risks":["..."],"watchlist":["SYM"]}.',
    'Máximo 3 escenarios y 4 riesgos. Textos en español, sin markdown.',
  ].join(' ');

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://stock-analyzer-new.vercel.app',
        'X-Title': 'StockAnalyzer Resumen Semanal',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(compact) },
        ],
        max_tokens: 2500,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const text = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.message?.reasoning || '';
    return parseWeeklyAi(typeof text === 'string' ? text : JSON.stringify(text));
  } catch (err) {
    console.warn('[weekly-summary] IA no disponible:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function buildPayload() {
  const now = new Date();
  const ctx = getWeekContext(now);
  const warnings: string[] = [];

  let series: PulseSeries = {};
  let pulsePayload: Awaited<ReturnType<typeof buildMarketPulsePayload>> | null = null;
  try {
    series = await fetchPulseSeries();
    pulsePayload = {
      ...buildMarketPulse({ series }),
      source: 'Yahoo Finance (precios diarios de ETFs/índices)',
      updatedAt: now.toISOString(),
      notes: [],
    };
  } catch (err) {
    warnings.push(`Market Pulse no disponible: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  const [events, news] = await Promise.all([
    fetchEvents(ctx.nextWeek.start, ctx.nextWeek.end).catch(() => [] as WeeklyEvent[]),
    Promise.allSettled([
      getMassiveNews({ limit: 30 }),
      getGeneralNews(),
    ]).then(([a, b]) => [
      ...(a.status === 'fulfilled' ? a.value : []),
      ...(b.status === 'fulfilled' ? b.value : []),
    ]),
  ]);

  const newsSentiment = (() => {
    const tagged = news.filter((n: any) => typeof n?.sentiment === 'string' && n.sentiment.length > 0);
    if (tagged.length === 0) return null;
    const positive = tagged.filter((n: any) => n.sentiment === 'positive').length;
    const negative = tagged.filter((n: any) => n.sentiment === 'negative').length;
    const neutral = tagged.length - positive - negative;
    return {
      positive, negative, neutral, total: tagged.length,
      net: Math.round(((positive - negative) / tagged.length) * 100) / 100,
    };
  })();

  const base = buildWeeklySummary({
    asOf: now,
    series,
    pulse: pulseLite(pulsePayload),
    events,
    newsSentiment,
  });

  if (events.length === 0) warnings.push('Calendario de la próxima semana sin eventos disponibles.');
  const ai = await askAi(base);
  const payload = buildWeeklySummary({
    asOf: now,
    indices: base.indices,
    pulse: pulseLite(pulsePayload),
    events,
    newsSentiment,
    ai,
  });

  return {
    ...payload,
    source: 'Yahoo Finance + Finnhub + Massive + TradingView',
    updatedAt: now.toISOString(),
    notes: [
      'El pronóstico es una lectura de datos pasados y eventos conocidos, no una predicción garantizada.',
      ...base.notes,
      ...(ai ? [] : ['IA no disponible: se muestra el resumen determinista.']),
    ],
    warnings: [...warnings, ...base.warnings],
  };
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1';
  const ctx = getWeekContext(new Date());
  const key = `weekly-summary:v1:${ctx.etDate}`;

  if (!force) {
    const cached = await cacheGet<any>(key);
    if (cached) return NextResponse.json({ ...cached, cached: true });
  }

  try {
    const payload = await buildPayload();
    await cacheSet(key, payload, CACHE_TTL);
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[weekly-summary] error:', err);
    return NextResponse.json(
      { error: 'No se pudo construir el resumen semanal', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 502 }
    );
  }
}
