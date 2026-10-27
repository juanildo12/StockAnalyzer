// Market Pulse — índice tipo Fear & Greed + probabilidad histórica condicional.
//
// Todo puro (sin I/O) para poder testearlo. El índice se construye SOLO con
// precios diarios de ETFs/índices líquidos (Yahoo), y cada componente se
// normaliza con un percentil **point-in-time** (ventana trailing) para no usar
// información futura. La "predicción" son frecuencias condicionales históricas
// del retorno forward de SPY agrupadas por el nivel del índice: no es un
// modelo entrenado ni una promesa.
//
// Convención: 0 = miedo extremo, 100 = codicia extrema (igual que CNN).

export interface DailyClose {
  date: string;
  close: number;
}

export type PulseSeries = Record<string, DailyClose[]>;

export interface MarketPulseInput {
  series: PulseSeries;
  /** Sesiones usadas para el percentil trailing (default 504 ≈ 2 años). */
  normWindow?: number;
  /** Muestras mínimas para emitir un percentil (default 126). */
  minSamples?: number;
  /** Sesiones mínimas de historia antes de emitir el índice (default 252). */
  minHistory?: number;
  /** Horizontes forward en sesiones (default [5, 10, 21]). */
  horizons?: number[];
  /** Fecha de corte (YYYY-MM-DD). Default: último cierre de SPY. */
  asOf?: string;
}

export const PULSE_SYMBOLS = {
  spy: 'SPY',
  qqq: 'QQQ',
  iwm: 'IWM',
  rsp: 'RSP',
  tlt: 'TLT',
  hyg: 'HYG',
  ief: 'IEF',
  gld: 'GLD',
  vix: '^VIX',
  vix3m: '^VIX3M',
} as const;

export type PulseComponentKey =
  | 'momentum'
  | 'breadth'
  | 'volatility'
  | 'safeHaven'
  | 'credit'
  | 'hedge';

export type PulseZone =
  | 'extreme-fear'
  | 'fear'
  | 'neutral'
  | 'greed'
  | 'extreme-greed'
  | 'na';

export const PULSE_ZONES: Array<{ zone: PulseZone; label: string; min: number; max: number }> = [
  { zone: 'extreme-fear', label: 'Miedo extremo', min: 0, max: 20 },
  { zone: 'fear', label: 'Miedo', min: 20, max: 40 },
  { zone: 'neutral', label: 'Neutral', min: 40, max: 60 },
  { zone: 'greed', label: 'Codicia', min: 60, max: 80 },
  { zone: 'extreme-greed', label: 'Codicia extrema', min: 80, max: 100 },
];

export function scoreZone(score: number | null): PulseZone {
  if (score == null || !Number.isFinite(score)) return 'na';
  if (score < 20) return 'extreme-fear';
  if (score < 40) return 'fear';
  if (score < 60) return 'neutral';
  if (score < 80) return 'greed';
  return 'extreme-greed';
}

export function zoneLabel(zone: PulseZone): string {
  return PULSE_ZONES.find((z) => z.zone === zone)?.label ?? 'Sin datos';
}

export interface PulseComponent {
  key: PulseComponentKey;
  label: string;
  weight: number;
  /** 0..100 (100 = codicia). */
  score: number | null;
  /** Valor bruto principal, ya formateado para la UI. */
  valueLabel: string;
  detail: string;
  /** Puntos que aporta al índice (peso normalizado × score). */
  contribution: number | null;
  available: boolean;
}

export interface PulsePoint {
  date: string;
  score: number;
}

export interface BucketStat {
  bucket: string;
  min: number;
  max: number;
  samples: number;
  pUp: number | null;
  pDown: number | null;
  ci95: [number, number] | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  p10: number | null;
  p90: number | null;
}

export interface HorizonForecast {
  horizon: number;
  bucket: string;
  samples: number;
  pUp: number | null;
  pDown: number | null;
  ci95: [number, number] | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  p10: number | null;
  p90: number | null;
  /** Frecuencia incondicional de días al alza del mismo horizonte. */
  baselinePUp: number | null;
  /** pUp − baseline, en puntos porcentuales. */
  edgePp: number | null;
}

export interface PulseMeta {
  sessions: number;
  firstScoreDate: string | null;
  symbols: string[];
  missingSymbols: string[];
  normWindow: number;
  minHistory: number;
  dataQuality: number;
  warnings: string[];
}

export interface MarketPulseResult {
  asOf: string;
  score: number | null;
  zone: PulseZone;
  label: string;
  delta5d: number | null;
  delta21d: number | null;
  components: PulseComponent[];
  history: PulsePoint[];
  probabilities: HorizonForecast[];
  buckets: BucketStat[];
  baseline: { samples: number; pUp: number | null } | null;
  meta: PulseMeta;
}

export const PULSE_NOTES = [
  'Índice construido con precios diarios de SPY, QQQ, IWM, RSP, TLT, HYG, IEF, GLD, ^VIX y ^VIX3M (Yahoo). No usa breadth real de constituyentes ni posicionamiento de opciones.',
  'Cada componente se normaliza con su propio percentil de las últimas ~2 años (point-in-time): 100 = el mercado está tan eufórico como en el percentil más alto de esa ventana.',
  'Las probabilidades son frecuencias históricas condicionales del retorno forward de SPY por nivel del índice; muestran lo que pasó, no lo que va a pasar. Muestras pequeñas = intervalos anchos.',
  'Lecturas extremas se interpretan a menudo como contrarias (miedo extremo → rebote; codicia extrema → riesgo), pero el mercado puede quedarse extremo mucho tiempo. No es una recomendación de inversión.',
];

// ── Helpers numéricos ────────────────────────────────────────────────────────

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Percentil por rango lineal (0..100) de un valor ya ordenado. */
function quantileSorted(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Percentil point-in-time del último valor dentro de una ventana trailing.
 * Devuelve null si no hay suficientes muestras.
 */
export function percentileOfLast(values: Array<number | null>, window: number, minSamples: number): number | null {
  if (values.length === 0) return null;
  const last = values[values.length - 1];
  if (last == null || !Number.isFinite(last)) return null;
  const start = Math.max(0, values.length - window);
  const sample: number[] = [];
  for (let i = start; i < values.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) sample.push(v);
  }
  if (sample.length < minSamples) return null;
  let less = 0;
  let equal = 0;
  for (const v of sample) {
    if (v < last) less++;
    else if (v === last) equal++;
  }
  return ((less + 0.5 * equal) / sample.length) * 100;
}

/** Percentil trailing para cada punto de la serie (sin look-ahead). */
export function rollingPercentile(
  values: Array<number | null>,
  window = 504,
  minSamples = 126
): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    const start = Math.max(0, i - window + 1);
    const sample: number[] = [];
    for (let j = start; j <= i; j++) {
      const x = values[j];
      if (x != null && Number.isFinite(x)) sample.push(x);
    }
    if (sample.length < minSamples) continue;
    let less = 0;
    let equal = 0;
    for (const x of sample) {
      if (x < v) less++;
      else if (x === v) equal++;
    }
    out[i] = ((less + 0.5 * equal) / sample.length) * 100;
  }
  return out;
}

/** Intervalo de confianza 95% de Wilson para una proporción. */
export function wilsonInterval(successes: number, n: number, z = 1.96): [number, number] | null {
  if (n <= 0) return null;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half) * 100, Math.min(1, center + half) * 100];
}

export const PULSE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0-20', min: 0, max: 20 },
  { label: '20-40', min: 20, max: 40 },
  { label: '40-60', min: 40, max: 60 },
  { label: '60-80', min: 60, max: 80 },
  { label: '80-100', min: 80, max: 100.0001 },
];

export function bucketOf(score: number): string {
  for (const b of PULSE_BUCKETS) {
    if (score >= b.min && score < b.max) return b.label;
  }
  return score >= 100 ? '80-100' : '0-20';
}

// ── Series / alignment ───────────────────────────────────────────────────────

function alignToDates(bars: DailyClose[], dates: string[]): Array<number | null> {
  const map = new Map<string, number>();
  for (const b of bars) {
    if (Number.isFinite(b.close) && b.close > 0) map.set(b.date, b.close);
  }
  const out: Array<number | null> = [];
  let last: number | null = null;
  let lastMs = 0;
  for (const d of dates) {
    const v = map.get(d);
    const ms = Date.parse(d + 'T00:00:00Z');
    if (v != null) {
      last = v;
      lastMs = ms;
      out.push(v);
    } else if (last != null && Number.isFinite(ms) && ms - lastMs <= 7 * 86_400_000) {
      // Feriados/ausencias cortas: se arrastra el último cierre.
      out.push(last);
    } else {
      out.push(null);
    }
  }
  return out;
}

function ratioAt(values: Array<number | null>, i: number, lookback: number): number | null {
  if (i - lookback < 0) return null;
  const a = values[i];
  const b = values[i - lookback];
  if (a == null || b == null || b <= 0) return null;
  return a / b;
}

function relReturn(a: Array<number | null>, b: Array<number | null>, i: number, lookback: number): number | null {
  const ra = ratioAt(a, i, lookback);
  const rb = ratioAt(b, i, lookback);
  if (ra == null || rb == null || rb <= 0) return null;
  return ra / rb - 1;
}

function smaAt(values: Array<number | null>, i: number, period: number): number | null {
  if (i - period + 1 < 0) return null;
  let sum = 0;
  for (let j = i - period + 1; j <= i; j++) {
    const v = values[j];
    if (v == null || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum / period;
}

function pct(v: number | null, digits = 1, suffix = '%'): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}${suffix}`;
}

// ── Definición de componentes ────────────────────────────────────────────────

interface ComponentDef {
  key: PulseComponentKey;
  label: string;
  weight: number;
  subs: Array<{ key: string; invert?: boolean }>;
}

const COMPONENT_DEFS: ComponentDef[] = [
  { key: 'momentum', label: 'Momentum', weight: 0.2, subs: [{ key: 'spyRet20' }, { key: 'spyVsSma125' }] },
  { key: 'breadth', label: 'Amplitud', weight: 0.2, subs: [{ key: 'rspVsSpy' }, { key: 'iwmVsSpy' }, { key: 'aboveSma50' }] },
  { key: 'volatility', label: 'Volatilidad', weight: 0.2, subs: [{ key: 'vix', invert: true }, { key: 'vixTerm' }] },
  { key: 'safeHaven', label: 'Refugio seguro', weight: 0.15, subs: [{ key: 'tltVsSpy', invert: true }] },
  { key: 'credit', label: 'Crédito', weight: 0.15, subs: [{ key: 'hygVsIef' }] },
  { key: 'hedge', label: 'Cobertura (oro)', weight: 0.1, subs: [{ key: 'gldVsSpy', invert: true }] },
];

// ── Motor ────────────────────────────────────────────────────────────────────

export function buildMarketPulse(input: MarketPulseInput): MarketPulseResult {
  const normWindow = input.normWindow ?? 504;
  const minSamples = input.minSamples ?? 126;
  const minHistory = input.minHistory ?? 252;
  const horizons = (input.horizons ?? [5, 10, 21]).slice().sort((a, b) => a - b);

  const canonical = Object.values(PULSE_SYMBOLS);
  const present = canonical.filter((s) => Array.isArray(input.series[s]) && input.series[s].length > 0);
  const missingSymbols = canonical.filter((s) => !present.includes(s));

  const spyBars = input.series[PULSE_SYMBOLS.spy] ?? [];
  if (spyBars.length === 0) throw new Error('Sin datos de SPY para construir el índice.');

  const dates = spyBars.map((b) => b.date).sort();
  const closes: Record<string, Array<number | null>> = {};
  for (const sym of canonical) {
    closes[sym] = present.includes(sym) ? alignToDates(input.series[sym], dates) : dates.map(() => null);
  }
  const spy = closes[PULSE_SYMBOLS.spy];

  // Señales brutas alineadas al calendario de SPY.
  const raw: Record<string, Array<number | null>> = {};

  raw.spyRet20 = spy.map((_, i) => {
    const r = ratioAt(spy, i, 20);
    return r == null ? null : (r - 1) * 100;
  });
  raw.spyVsSma125 = spy.map((v, i) => {
    const s = smaAt(spy, i, 125);
    return s == null || v == null ? null : (v / s - 1) * 100;
  });
  raw.rspVsSpy = spy.map((_, i) => {
    const r = relReturn(closes[PULSE_SYMBOLS.rsp], spy, i, 20);
    return r == null ? null : r * 100;
  });
  raw.iwmVsSpy = spy.map((_, i) => {
    const r = relReturn(closes[PULSE_SYMBOLS.iwm], spy, i, 20);
    return r == null ? null : r * 100;
  });
  raw.aboveSma50 = spy.map((_, i) => {
    const keys = [PULSE_SYMBOLS.spy, PULSE_SYMBOLS.qqq, PULSE_SYMBOLS.iwm, PULSE_SYMBOLS.rsp];
    let up = 0;
    let total = 0;
    for (const k of keys) {
      const v = closes[k][i];
      const s = smaAt(closes[k], i, 50);
      if (v == null || s == null) continue;
      total++;
      if (v > s) up++;
    }
    return total === 0 ? null : (up / total) * 100;
  });
  raw.vix = closes[PULSE_SYMBOLS.vix].map((v) => (v == null ? null : v));
  raw.vixTerm = spy.map((_, i) => {
    const a = closes[PULSE_SYMBOLS.vix];
    const b = closes[PULSE_SYMBOLS.vix3m];
    const short = a[i];
    const long = b[i];
    if (short == null || long == null || short <= 0) return null;
    return (long / short - 1) * 100;
  });
  raw.tltVsSpy = spy.map((_, i) => {
    const r = relReturn(closes[PULSE_SYMBOLS.tlt], spy, i, 20);
    return r == null ? null : r * 100;
  });
  raw.hygVsIef = spy.map((_, i) => {
    const r = relReturn(closes[PULSE_SYMBOLS.hyg], closes[PULSE_SYMBOLS.ief], i, 20);
    return r == null ? null : r * 100;
  });
  raw.gldVsSpy = spy.map((_, i) => {
    const r = relReturn(closes[PULSE_SYMBOLS.gld], spy, i, 20);
    return r == null ? null : r * 100;
  });

  // Percentiles point-in-time (invertidos donde "más" = miedo).
  const subScores: Record<string, Array<number | null>> = {};
  for (const def of COMPONENT_DEFS) {
    for (const sub of def.subs) {
      const series = raw[sub.key] ?? spy.map(() => null);
      const pctSeries = rollingPercentile(series, normWindow, minSamples);
      subScores[sub.key] = sub.invert
        ? pctSeries.map((v) => (v == null ? null : 100 - v))
        : pctSeries;
    }
  }

  const componentScoreAt = (def: ComponentDef, i: number): number | null => {
    const vals: number[] = [];
    for (const sub of def.subs) {
      const v = subScores[sub.key]?.[i];
      if (v != null && Number.isFinite(v)) vals.push(v);
    }
    return vals.length === 0 ? null : mean(vals);
  };

  // Serie completa del índice (solo días con >= 3 componentes y warm-up).
  const history: PulsePoint[] = [];
  const compositeAt: Array<number | null> = spy.map(() => null);
  for (let i = 0; i < dates.length; i++) {
    if (i < minHistory) continue;
    let sum = 0;
    let weight = 0;
    let available = 0;
    for (const def of COMPONENT_DEFS) {
      const s = componentScoreAt(def, i);
      if (s == null) continue;
      available++;
      sum += s * def.weight;
      weight += def.weight;
    }
    if (available < 3 || weight <= 0) continue;
    const score = sum / weight;
    compositeAt[i] = score;
    history.push({ date: dates[i], score });
  }

  // Índice de evaluación (corte opcional, sin mirar el futuro).
  let idx = dates.length - 1;
  if (input.asOf) {
    const cut = dates.filter((d) => d <= input.asOf!).length - 1;
    idx = cut;
  }
  if (idx < 0) throw new Error('La fecha de corte no tiene datos.');
  while (idx >= 0 && compositeAt[idx] == null) idx--;
  const score = idx >= 0 ? compositeAt[idx] : null;
  const asOf = idx >= 0 ? dates[idx] : dates[dates.length - 1];

  const deltaAt = (back: number): number | null => {
    if (score == null || idx - back < 0) return null;
    const prev = compositeAt[idx - back];
    return prev == null ? null : score - prev;
  };

  // Componentes del día de corte (pesos normalizados a los disponibles).
  let availWeight = 0;
  for (const def of COMPONENT_DEFS) {
    if (componentScoreAt(def, idx) != null) availWeight += def.weight;
  }
  const components: PulseComponent[] = COMPONENT_DEFS.map((def) => {
    const s = idx >= 0 ? componentScoreAt(def, idx) : null;
    const available = s != null;
    const weightNorm = available && availWeight > 0 ? def.weight / availWeight : 0;
    return {
      key: def.key,
      label: def.label,
      weight: def.weight,
      score: s,
      valueLabel: componentValueLabel(def.key, raw, idx),
      detail: componentDetail(def.key, raw, idx),
      contribution: available ? s! * weightNorm : null,
      available,
    };
  });

  // Probabilidades forward condicionales por bucket del índice.
  const bucket = score == null ? null : bucketOf(score);
  const bucketDef = PULSE_BUCKETS.find((b) => b.label === bucket) ?? null;
  const mainHorizon = horizons.length > 0 ? horizons[horizons.length - 1] : 21;
  const probabilities: HorizonForecast[] = [];
  const bucketsByHorizon: Record<number, BucketStat[]> = {};
  let baselineOut: { samples: number; pUp: number | null } | null = null;

  for (const h of horizons) {
    const samples: Array<{ score: number; fwd: number }> = [];
    for (let i = 0; i + h < dates.length; i++) {
      const s = compositeAt[i];
      if (s == null) continue;
      const a = spy[i];
      const b = spy[i + h];
      if (a == null || b == null || a <= 0) continue;
      samples.push({ score: s, fwd: (b / a - 1) * 100 });
    }
    const all = samples.map((x) => x.fwd);
    const baselineUp = all.filter((v) => v > 0).length;
    const baselinePUp = all.length > 0 ? (baselineUp / all.length) * 100 : null;

    const bucketSamples = bucket == null ? [] : samples.filter((x) => bucketOf(x.score) === bucket);
    const stat = summarizeBucket(
      bucketSamples.map((x) => x.fwd),
      bucket ?? '—',
      bucketDef?.min ?? 0,
      bucketDef?.max ?? 0
    );
    probabilities.push({
      horizon: h,
      bucket: bucket ?? '—',
      samples: stat.samples,
      pUp: stat.pUp,
      pDown: stat.pDown,
      ci95: stat.ci95,
      avgReturnPct: stat.avgReturnPct,
      medianReturnPct: stat.medianReturnPct,
      p10: stat.p10,
      p90: stat.p90,
      baselinePUp,
      edgePp: stat.pUp != null && baselinePUp != null ? stat.pUp - baselinePUp : null,
    });

    const table: BucketStat[] = PULSE_BUCKETS.map((b) => {
      const vals = samples.filter((x) => bucketOf(x.score) === b.label).map((x) => x.fwd);
      return summarizeBucket(vals, b.label, b.min, b.max);
    });
    bucketsByHorizon[h] = table;
    if (h === mainHorizon) baselineOut = { samples: all.length, pUp: baselinePUp };
  }

  const buckets = bucketsByHorizon[mainHorizon] ?? [];
  const baseline = baselineOut;

  const warnings: string[] = [];
  const availableComponents = components.filter((c) => c.available).length;
  if (availableComponents < COMPONENT_DEFS.length) {
    warnings.push(`Índice parcial: ${availableComponents} de ${COMPONENT_DEFS.length} componentes disponibles.`);
  }
  if (missingSymbols.length > 0) {
    warnings.push(`Sin datos para: ${missingSymbols.join(', ')}.`);
  }
  const lastMs = Date.parse(asOf + 'T00:00:00Z');
  if (Number.isFinite(lastMs) && Date.now() - lastMs > 5 * 86_400_000) {
    warnings.push(`Último cierre disponible: ${asOf} (los datos pueden estar retrasados).`);
  }
  if (score == null) warnings.push('No hay suficientes datos para calcular el índice.');

  const dataQuality = availableComponents === 0
    ? 0
    : Math.round((availableComponents / COMPONENT_DEFS.length) * 100);

  return {
    asOf,
    score,
    zone: scoreZone(score),
    label: zoneLabel(scoreZone(score)),
    delta5d: deltaAt(5),
    delta21d: deltaAt(21),
    components,
    history,
    probabilities,
    buckets,
    baseline,
    meta: {
      sessions: dates.length,
      firstScoreDate: history.length > 0 ? history[0].date : null,
      symbols: present,
      missingSymbols,
      normWindow,
      minHistory,
      dataQuality,
      warnings,
    },
  };
}

function summarizeBucket(
  returns: number[],
  bucket: string,
  min: number,
  max: number
): BucketStat {
  const n = returns.length;
  if (n === 0) {
    return {
      bucket, min, max, samples: 0, pUp: null, pDown: null, ci95: null,
      avgReturnPct: null, medianReturnPct: null, p10: null, p90: null,
    };
  }
  const sorted = returns.slice().sort((a, b) => a - b);
  const up = returns.filter((v) => v > 0).length;
  const down = returns.filter((v) => v < 0).length;
  return {
    bucket,
    min,
    max,
    samples: n,
    pUp: (up / n) * 100,
    pDown: (down / n) * 100,
    ci95: wilsonInterval(up, n),
    avgReturnPct: mean(returns),
    medianReturnPct: median(returns),
    p10: quantileSorted(sorted, 0.1),
    p90: quantileSorted(sorted, 0.9),
  };
}

// Valor bruto "principal" de cada componente para la tarjeta.
function componentValueLabel(key: PulseComponentKey, raw: Record<string, Array<number | null>>, i: number): string {
  if (i < 0) return '—';
  const get = (k: string) => raw[k]?.[i] ?? null;
  switch (key) {
    case 'momentum':
      return `SPY 20d ${pct(get('spyRet20'))}`;
    case 'breadth': {
      const v = get('aboveSma50');
      return v == null ? '—' : `${v.toFixed(0)}% de índices > SMA50`;
    }
    case 'volatility': {
      const v = get('vix');
      return v == null ? '—' : `VIX ${v.toFixed(1)}`;
    }
    case 'safeHaven':
      return `TLT vs SPY 20d ${pct(get('tltVsSpy'))}`;
    case 'credit':
      return `HYG vs IEF 20d ${pct(get('hygVsIef'))}`;
    case 'hedge':
      return `GLD vs SPY 20d ${pct(get('gldVsSpy'))}`;
    default:
      return '—';
  }
}

function componentDetail(key: PulseComponentKey, raw: Record<string, Array<number | null>>, i: number): string {
  if (i < 0) return 'Sin datos.';
  const get = (k: string) => raw[k]?.[i] ?? null;
  switch (key) {
    case 'momentum':
      return `SPY vs SMA125 ${pct(get('spyVsSma125'))}.`;
    case 'breadth':
      return `RSP/SPY 20d ${pct(get('rspVsSpy'))} · IWM/SPY 20d ${pct(get('iwmVsSpy'))}.`;
    case 'volatility':
      return `VIX3M/VIX ${pct(get('vixTerm'))} (positivo = contango, mercado tranquilo).`;
    case 'safeHaven':
      return get('tltVsSpy') != null && get('tltVsSpy')! > 0
        ? 'Los bonos largos ganan al S&P: demanda de refugio.'
        : 'Los bonos largos no lideran: menos miedo.';
    case 'credit':
      return get('hygVsIef') != null && get('hygVsIef')! > 0
        ? 'El high yield gana a los Treasuries: apetito por riesgo.'
        : 'El high yield pierde contra los Treasuries: aversión al riesgo.';
    case 'hedge':
      return get('gldVsSpy') != null && get('gldVsSpy')! > 0
        ? 'El oro gana al S&P: demanda de cobertura.'
        : 'El oro no lidera: menos necesidad de cobertura.';
    default:
      return '';
  }
}
