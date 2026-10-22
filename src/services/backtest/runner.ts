// Orquestador del backtest: carga los datos, calcula las señales y ejecuta
// el motor determinista.

import { loadBars } from './data';
import { buildSignalMap, runEngine, tradingCalendar } from './engine';
import { buildAiSignalMap } from './ai';
import type { BacktestConfig, BacktestResult, Bar } from './types';

/** Días de calendario de "calentamiento" para los indicadores (SMA200). */
const WARMUP_DAYS = 420;

export interface RunOptions {
  /** Días de trading entre rebalanceos en modo IA. */
  rebalanceEvery?: number;
  maxCalls?: number;
}

export function normalizeConfig(input: Partial<BacktestConfig>): BacktestConfig {
  const symbols = Array.from(
    new Set(
      (input.symbols || [])
        .map((s) => String(s).trim().toUpperCase())
        .filter((s) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)),
    ),
  );
  const startDate = String(input.startDate || '').slice(0, 10);
  const endDate = String(input.endDate || '').slice(0, 10);
  const initialCash = Math.max(100, Number(input.initialCash) || 100000);
  const strategy = (input.strategy || 'trend') as BacktestConfig['strategy'];
  const commissionBps = Math.min(200, Math.max(0, Number(input.commissionBps) || 0));
  const slippageBps = Math.min(200, Math.max(0, Number(input.slippageBps) || 0));
  const benchmark = String(input.benchmark || 'SPY').trim().toUpperCase() || 'SPY';
  return { symbols, startDate, endDate, initialCash, strategy, commissionBps, slippageBps, benchmark };
}

export async function runBacktest(
  rawConfig: Partial<BacktestConfig>,
  options: RunOptions = {},
): Promise<BacktestResult> {
  const config = normalizeConfig(rawConfig);

  if (config.symbols.length === 0) throw new Error('Indica al menos un símbolo válido.');
  if (!config.startDate || !config.endDate) throw new Error('Indica las fechas de inicio y fin.');
  if (config.endDate <= config.startDate) throw new Error('La fecha de fin debe ser posterior a la de inicio.');

  const start = new Date(`${config.startDate}T00:00:00.000Z`);
  const end = new Date(`${config.endDate}T00:00:00.000Z`);
  const today = new Date();
  if (end > today) end.setTime(today.getTime());

  const warmupStart = new Date(start.getTime() - WARMUP_DAYS * 86400000);

  const notes: string[] = [];
  const barsBySymbol: Record<string, Bar[]> = {};
  const sources = new Set<string>();

  const wanted = [...config.symbols];
  if (!wanted.includes(config.benchmark)) wanted.push(config.benchmark);

  for (const sym of wanted) {
    const { bars, source } = await loadBars(sym, warmupStart, end);
    barsBySymbol[sym] = bars;
    sources.add(source === 'cache' ? 'Yahoo (caché)' : source);
  }

  const benchmarkBars = barsBySymbol[config.benchmark] || [];
  const calendar = tradingCalendar(benchmarkBars, config.startDate, config.endDate);

  if (calendar.length < 2) {
    throw new Error(
      `El benchmark ${config.benchmark} no tiene sesiones suficientes en el periodo indicado (${calendar.length}). Revisa las fechas o prueba otro benchmark.`,
    );
  }

  // ¿Hay datos de todos los símbolos?
  for (const sym of config.symbols) {
    const bars = barsBySymbol[sym] || [];
    const inPeriod = bars.filter((b) => b.date >= config.startDate && b.date <= config.endDate);
    if (inPeriod.length === 0) {
      notes.push(`${sym}: sin sesiones en el periodo (se ignora en el backtest).`);
    }
  }

  let signalMap: Record<string, Record<string, { target: 0 | 1; score: number; reason: string }>>;
  if (config.strategy === 'ai') {
    if (!process.env.OPENROUTER_API_KEY) {
      notes.push('OPENROUTER_API_KEY no configurada: se usa la estrategia de tendencia en lugar del agente IA.');
      signalMap = buildSignalMap({ ...config, strategy: 'trend' }, barsBySymbol, calendar);
    } else {
      const ai = await buildAiSignalMap(config, barsBySymbol, calendar, {
        rebalanceEvery: options.rebalanceEvery ?? 10,
        maxCalls: options.maxCalls ?? 16,
      });
      signalMap = ai.signalMap;
      notes.push(...ai.notes);
      notes.push(
        `Agente IA: ${ai.calls} llamadas al modelo (rebalanceo cada ${options.rebalanceEvery ?? 10} sesiones).`,
      );
    }
  } else {
    signalMap = buildSignalMap(config, barsBySymbol, calendar);
  }

  const result = runEngine({
    config,
    barsBySymbol,
    benchmarkBars,
    signalMap,
    dataSource: Array.from(sources).join(' + '),
    notes,
  });

  return result;
}
