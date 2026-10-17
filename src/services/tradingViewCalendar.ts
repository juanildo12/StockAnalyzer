/**
 * Economic calendar from TradingView (free, unofficial endpoint).
 *
 * Finnhub's `/economic/calendar` is premium-only, so macro catalysts (FOMC,
 * CPI, NFP, GDP, PCE, ISM...) were missing from the catalysts calendar. This
 * endpoint returns events for an arbitrary date range and includes the Fed
 * interest-rate decision.
 *
 * The endpoint is not officially documented; degrade gracefully to `[]`.
 */

const CALENDAR_BASE = 'https://economic-calendar.tradingview.com/events';

export interface EconomicEvent {
  id: string;
  title: string;
  indicator: string;
  country: string;
  /** ISO timestamp (UTC). */
  date: string;
  /** TradingView scale: 1 = high, 0 = medium, -1 = low. */
  importance: number;
  importanceLabel: 'high' | 'medium' | 'low';
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  period: string;
  category: string;
}

export interface EconomicQuery {
  countries?: string;
  /** TradingView minimum importance: -1 low, 0 medium, 1 high. */
  minImportance?: number;
  maxWaitMs?: number;
}

/** Indicadores de bajo valor que ensucian el calendario (semanal/diario, ruido). */
const NOISE_INDICATOR = /(crude oil|gasoline|natural gas|mortgage rate|eia |api crude|refinery|gdpnow|atlanta fed|adp employment change weekly)/i;

/** Disertaciones de miembros de la Fed: ruido salvo que sean de impacto alto. */
const SPEECH = /(speech|speaks|testimony|comments)/i;

export function normalizeEconomicEvent(row: any): EconomicEvent | null {
  if (!row || typeof row !== 'object') return null;
  const date = row.date;
  if (!date || typeof date !== 'string') return null;
  const title = row.title || row.indicator || '';
  if (!title) return null;

  const importance = Number(row.importance ?? -1);
  const importanceLabel: EconomicEvent['importanceLabel'] =
    importance >= 1 ? 'high' : importance >= 0 ? 'medium' : 'low';

  return {
    id: String(row.id ?? `${row.country}:${date}:${title}`),
    title,
    indicator: row.indicator || '',
    country: row.country || '',
    date,
    importance: Number.isFinite(importance) ? importance : -1,
    importanceLabel,
    forecast: row.forecast != null && row.forecast !== '' ? String(row.forecast) : null,
    previous: row.previous != null && row.previous !== '' ? String(row.previous) : null,
    actual: row.actual != null && row.actual !== '' ? String(row.actual) : null,
    period: row.period || '',
    category: row.category || '',
  };
}

/** Filtra el ruido para que el calendario muestre solo catalizadores de verdad. */
export function isRelevantEconomicEvent(e: EconomicEvent): boolean {
  if (NOISE_INDICATOR.test(e.indicator) || NOISE_INDICATOR.test(e.title)) return false;
  if (e.importance < 1 && SPEECH.test(e.title)) return false;
  return true;
}

export function normalizeEconomicEvents(raw: any): EconomicEvent[] {
  const rows: any[] = Array.isArray(raw?.result) ? raw.result : [];
  const out: EconomicEvent[] = [];
  for (const r of rows) {
    const e = normalizeEconomicEvent(r);
    if (e && isRelevantEconomicEvent(e)) out.push(e);
  }
  return out;
}

/**
 * Catalizadores macro (EE.UU. por defecto) entre `fromIso` y `toIso`
 * (YYYY-MM-DD). Devuelve [] ante cualquier fallo o timeout.
 */
export async function getEconomicEvents(
  fromIso: string,
  toIso: string,
  q: EconomicQuery = {}
): Promise<EconomicEvent[]> {
  const from = `${fromIso}T00:00:00.000Z`;
  const to = `${toIso}T23:59:59.000Z`;
  const params = new URLSearchParams({
    from,
    to,
    countries: q.countries || 'US',
    minImportance: String(q.minImportance ?? 0),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), q.maxWaitMs ?? 8000);
  try {
    const res = await fetch(`${CALENDAR_BASE}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockAnalyzer/1.0)',
        Origin: 'https://www.tradingview.com',
        Referer: 'https://www.tradingview.com/',
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return normalizeEconomicEvents(json);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
