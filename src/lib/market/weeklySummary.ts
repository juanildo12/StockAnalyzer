import type { DailyClose } from './pulse';

export const WEEKLY_INDEX_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'RSP'] as const;

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ET_WEEKDAYS: Record<string, string> = {
  Mon: 'lunes', Tue: 'martes', Wed: 'miércoles', Thu: 'jueves',
  Fri: 'viernes', Sat: 'sábado', Sun: 'domingo',
};

export interface WeeklyIndexClose {
  symbol: string;
  close: number | null;
  prevClose: number | null;
  weeklyReturnPct: number | null;
  sessions: number;
  asOf: string | null;
}

export interface WeeklyEvent {
  iso: string;
  title: string;
  type: string;
  importance: number;
  emoji?: string;
  symbol?: string;
}

export interface WeeklyNewsSentiment {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  net: number;
}

export interface WeeklyPulse {
  score: number | null;
  zone: string | null;
  delta5d: number | null;
  pUp5d: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  baselinePUp: number | null;
  edgePp: number | null;
}

export interface WeeklyScenario {
  label: string;
  text: string;
}

export interface WeeklyAiOutlook {
  headline: string | null;
  bias: 'bullish' | 'bearish' | 'neutral' | null;
  scenarios: WeeklyScenario[];
  risks: string[];
  watchlist: string[];
}

export interface WeeklySummaryInput {
  asOf?: Date | string;
  series?: Record<string, DailyClose[]>;
  indices?: WeeklyIndexClose[];
  pulse?: WeeklyPulse | null;
  events?: WeeklyEvent[];
  newsSentiment?: WeeklyNewsSentiment | null;
  ai?: WeeklyAiOutlook | null;
}

export interface WeekContext {
  etDate: string;
  weekday: string;
  reviewWindow: boolean;
  weekKey: string;
  weekLabel: string;
  currentStart: string;
  currentEnd: string;
  nextWeek: { start: string; end: string; label: string };
}

export interface WeeklyOutlook {
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  headline: string;
  scenarios: WeeklyScenario[];
  risks: string[];
  watchlist: string[];
  score: number;
}

export interface WeeklySummaryResult extends WeekContext {
  available: boolean;
  indices: WeeklyIndexClose[];
  pulse: WeeklyPulse | null;
  events: WeeklyEvent[];
  newsSentiment: WeeklyNewsSentiment | null;
  outlook: WeeklyOutlook;
  aiUsed: boolean;
  notes: string[];
  warnings: string[];
}

function parseIso(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function mondayOf(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7;
  return addDays(d, -day);
}

export function etDateParts(asOf: Date): { date: string; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(asOf);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'),
  };
}

export function isoWeekKey(dateIso: string): string {
  const d = parseIso(dateIso);
  const thursday = addDays(mondayOf(d), 3);
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstThursday = addDays(mondayOf(jan4), 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`;
}

function rangeLabel(start: string, end: string): string {
  const a = parseIso(start);
  const b = parseIso(end);
  const left = `${a.getUTCDate()} ${MONTHS_ES[a.getUTCMonth()]}`;
  const right = a.getUTCMonth() === b.getUTCMonth()
    ? String(b.getUTCDate())
    : `${b.getUTCDate()} ${MONTHS_ES[b.getUTCMonth()]}`;
  return `${left} – ${right}`;
}

function buildWeekContext(dateIso: string, weekdayShort: string): WeekContext {
  const monday = mondayOf(parseIso(dateIso));
  const friday = addDays(monday, 4);
  const nextMonday = addDays(monday, 7);
  const nextFriday = addDays(monday, 11);
  return {
    etDate: dateIso,
    weekday: ET_WEEKDAYS[weekdayShort] || weekdayShort,
    reviewWindow: weekdayShort === 'Fri' || weekdayShort === 'Sat' || weekdayShort === 'Sun',
    weekKey: isoWeekKey(dateIso),
    weekLabel: rangeLabel(toIso(monday), toIso(friday)),
    currentStart: toIso(monday),
    currentEnd: toIso(friday),
    nextWeek: {
      start: toIso(nextMonday),
      end: toIso(nextFriday),
      label: rangeLabel(toIso(nextMonday), toIso(nextFriday)),
    },
  };
}

export function getWeekContext(asOf: Date | string): WeekContext {
  const date = asOf instanceof Date ? asOf : new Date(asOf);
  const et = etDateParts(date);
  return buildWeekContext(et.date, et.weekday);
}

export function weekContextFromEtDate(dateIso: string): WeekContext {
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseIso(dateIso).getUTCDay()];
  return buildWeekContext(dateIso.slice(0, 10), short);
}

export function computeWeeklyCloses(
  series: Record<string, DailyClose[]>,
  asOfIso: string,
  symbols: readonly string[] = WEEKLY_INDEX_SYMBOLS
): WeeklyIndexClose[] {
  const ctx = weekContextFromEtDate(asOfIso);
  return symbols.map((symbol) => {
    const bars = (series[symbol] || [])
      .filter(b => b.date <= ctx.etDate && Number.isFinite(b.close) && b.close > 0)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const current = bars.filter(b => b.date >= ctx.currentStart && b.date <= ctx.currentEnd);
    const last = current[current.length - 1] || null;
    const prev = bars.filter(b => b.date < ctx.currentStart).slice(-1)[0] || null;
    const weeklyReturnPct = last && prev
      ? Math.round(((last.close / prev.close) - 1) * 1000) / 10
      : null;
    return {
      symbol,
      close: last ? Math.round(last.close * 100) / 100 : null,
      prevClose: prev ? Math.round(prev.close * 100) / 100 : null,
      weeklyReturnPct,
      sessions: current.length,
      asOf: last ? last.date : null,
    };
  });
}

export function aggregateNewsSentiment(
  news: Array<{ sentiment?: string | null }>
): WeeklyNewsSentiment | null {
  const tagged = news.filter(n => typeof n.sentiment === 'string' && n.sentiment.length > 0);
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
  return {
    positive, negative, neutral, total,
    net: Math.round(((positive - negative) / total) * 100) / 100,
  };
}

function fmtPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function newsPhrase(sentiment: WeeklyNewsSentiment | null): string {
  if (!sentiment || sentiment.total === 0) return 'sin señal clara en las noticias';
  if (sentiment.net >= 0.15) return 'noticias mayormente positivas';
  if (sentiment.net <= -0.15) return 'noticias mayormente negativas';
  return 'noticias mixtas';
}

function deterministicOutlook(
  indices: WeeklyIndexClose[],
  pulse: WeeklyPulse | null,
  news: WeeklyNewsSentiment | null,
  events: WeeklyEvent[],
  ctx: WeekContext
): WeeklyOutlook {
  const weights: Record<string, number> = { SPY: 2, QQQ: 1.5, IWM: 1, RSP: 1 };
  const usable = indices.filter(i => i.weeklyReturnPct != null);
  const weightSum = usable.reduce((s, i) => s + (weights[i.symbol] || 1), 0);
  const avg = weightSum > 0
    ? usable.reduce((s, i) => s + (i.weeklyReturnPct || 0) * (weights[i.symbol] || 1), 0) / weightSum
    : 0;
  const edge = pulse?.edgePp ?? 0;
  const score = Math.round((avg * 2.4 + Math.max(-3, Math.min(3, edge * 0.35)) + (news?.net ?? 0) * 6) * 100) / 100;
  const bias: WeeklyOutlook['bias'] = score >= 1.2 ? 'bullish' : score <= -1.2 ? 'bearish' : 'neutral';

  let signals = 0;
  if (usable.length > 0) signals++;
  if (pulse?.score != null) signals++;
  if (news && news.total >= 5) signals++;
  if (events.length >= 3) signals++;
  const confidence: WeeklyOutlook['confidence'] = signals >= 4 ? 'high' : signals >= 2 ? 'medium' : 'low';

  const topEvent = events[0]?.title;
  const headline = bias === 'bullish'
    ? `Cierre semanal positivo (SPY ${fmtPct(usable.find(i => i.symbol === 'SPY')?.weeklyReturnPct ?? avg)}) y ${newsPhrase(news)}: sesgo alcista para ${ctx.nextWeek.label}.`
    : bias === 'bearish'
      ? `Cierre semanal negativo (SPY ${fmtPct(usable.find(i => i.symbol === 'SPY')?.weeklyReturnPct ?? avg)}) y ${newsPhrase(news)}: sesgo bajista para ${ctx.nextWeek.label}.`
      : `Cierre semanal mixto y ${newsPhrase(news)}: sesgo neutral para ${ctx.nextWeek.label}.`;

  const base = pulse?.pUp5d != null
    ? `SPY subió en ${pulse.pUp5d}% de situaciones similares a 5 sesiones (IC 95% ${pulse.ciLow}–${pulse.ciHigh}%; base ${pulse.baselinePUp}%, edge ${fmtPct(pulse.edgePp ?? 0)}).`
    : 'Sin Market Pulse disponible: no hay frecuencia histórica contrastada para esta lectura.';
  const scenarios: WeeklyScenario[] = [
    {
      label: 'Base',
      text: usable.length > 0
        ? `${base} El cierre semanal ponderado fue ${fmtPct(avg)}.`
        : base,
    },
    {
      label: 'Alcista',
      text: topEvent
        ? `Si el dato clave (${topEvent}) sorprende al alza, el movimiento semanal podría extenderse.`
        : 'Sin catalizadores identificados: la continuación dependería del flujo de noticias.',
    },
    {
      label: 'Bajista',
      text: pulse?.zone && /miedo|extremo/i.test(pulse.zone)
        ? `Con Market Pulse en zona "${pulse.zone}", un repunte de volatilidad podría revertir el sesgo.`
        : 'Un dato por debajo de lo esperado o un repunte de volatilidad podría revertir el sesgo.',
    },
  ];

  const risks: string[] = [];
  for (const e of events.filter(e => e.importance >= 85).slice(0, 3)) {
    risks.push(`${shortDate(e.iso)} · ${e.title}`);
  }
  if (news && news.net <= -0.15) risks.push(`Sentimiento de noticias negativo (net ${news.net})`);
  if (pulse?.score != null && (pulse.score < 25 || pulse.score > 75)) {
    risks.push(`Market Pulse en zona ${pulse.zone || 'extrema'} (${pulse.score})`);
  }
  if (risks.length === 0) risks.push('Sin riesgos destacados en los datos disponibles.');

  const watchlist = Array.from(new Set(events.map(e => e.symbol).filter((s): s is string => !!s))).slice(0, 5);

  return { bias, confidence, headline, scenarios, risks, watchlist, score };
}

export function parseWeeklyAi(text: string | null | undefined): WeeklyAiOutlook | null {
  if (!text) return null;
  const clean = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: any;
  try {
    obj = JSON.parse(clean.slice(start, end + 1));
  } catch {
    try {
      obj = JSON.parse(clean.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const validBias = ['bullish', 'bearish', 'neutral'].includes(obj.bias) ? obj.bias : null;
  const strings = (v: unknown): string[] => Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.replace(/[.\s]/g, '').length > 2).map((x: string) => x.trim()).slice(0, 8)
    : [];
  const meaningful = (v: unknown, min = 8): string => {
    if (typeof v !== 'string') return '';
    const text = v.trim();
    return text.replace(/[.\s]/g, '').length >= min ? text : '';
  };
  const scenarios = Array.isArray(obj.scenarios)
    ? obj.scenarios.slice(0, 4).map((s: any) => ({
        label: typeof s?.label === 'string' ? s.label.slice(0, 40) : 'Escenario',
        text: meaningful(s?.text, 10).slice(0, 400),
      })).filter((s: WeeklyScenario) => s.text.length > 0)
    : [];
  const headline = meaningful(obj.headline, 10).slice(0, 300) || null;
  if (!headline && !validBias && scenarios.length === 0 && strings(obj.risks).length === 0) return null;
  return {
    headline,
    bias: validBias,
    scenarios,
    risks: strings(obj.risks),
    watchlist: strings(obj.watchlist),
  };
}

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummaryResult {
  const asOf = input.asOf instanceof Date ? input.asOf : new Date(input.asOf || Date.now());
  const ctx = getWeekContext(asOf);
  const indices = input.indices
    || (input.series ? computeWeeklyCloses(input.series, ctx.etDate) : []);
  const events = (input.events || [])
    .filter(e => e.iso >= ctx.nextWeek.start && e.iso <= ctx.nextWeek.end)
    .sort((a, b) => b.importance - a.importance || (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
    .slice(0, 14);
  const pulse = input.pulse || null;
  const newsSentiment = input.newsSentiment || null;
  const base = deterministicOutlook(indices, pulse, newsSentiment, events, ctx);

  const ai = input.ai && (input.ai.headline || input.ai.scenarios.length > 0 || input.ai.risks.length > 0)
    ? input.ai
    : null;
  const outlook: WeeklyOutlook = ai
    ? {
        ...base,
        headline: ai.headline || base.headline,
        bias: ai.bias || base.bias,
        scenarios: ai.scenarios.length > 0 ? ai.scenarios : base.scenarios,
        risks: ai.risks.length > 0 ? ai.risks : base.risks,
        watchlist: ai.watchlist.length > 0 ? ai.watchlist : base.watchlist,
      }
    : base;

  const notes: string[] = [];
  const warnings: string[] = [];
  const available = indices.some(i => i.weeklyReturnPct != null) || !!pulse?.score || !!newsSentiment?.total || events.length > 0;
  if (!available) warnings.push('No hay datos suficientes para construir el resumen semanal.');
  if (!pulse) notes.push('Market Pulse no disponible: se omiten las probabilidades históricas.');
  if (!newsSentiment) notes.push('Noticias sin clasificación de sentimiento: se omiten en el cómputo.');
  if (!ctx.reviewWindow) notes.push('Fuera del viernes/fin de semana: se muestra un avance de la próxima semana.');

  return {
    ...ctx,
    available,
    indices,
    pulse,
    events,
    newsSentiment,
    outlook,
    aiUsed: !!ai,
    notes,
    warnings,
  };
}
