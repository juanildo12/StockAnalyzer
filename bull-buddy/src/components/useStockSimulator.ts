import { useState, useEffect, useRef, useCallback } from 'react';
import type { CandleData } from '../types';

type Trend = 'bull' | 'bear' | 'sideways';

const TREND_CONFIG: Record<Trend, { drift: number; volatility: number; label: string }> = {
  bull: { drift: 0.15, volatility: 0.3, label: '📈 Alcista' },
  bear: { drift: -0.12, volatility: 0.35, label: '📉 Bajista' },
  sideways: { drift: 0.02, volatility: 0.2, label: '➡️ Lateral' },
};

const TREND_WEIGHTS: Trend[] = ['bull', 'bear', 'sideways', 'sideways', 'bull', 'sideways', 'bear'];
const TICK_INTERVAL_MS = 2500;
const CANDLES_TO_KEEP = 60;
const INITIAL_PRICE = 50;

function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickNextTrend(current: Trend): Trend {
  const idx = TREND_WEIGHTS.indexOf(current);
  if (idx >= 0 && idx < TREND_WEIGHTS.length - 1) return TREND_WEIGHTS[idx + 1];
  return TREND_WEIGHTS[Math.floor(Math.random() * TREND_WEIGHTS.length)];
}

function generateCandle(prevClose: number, drift: number, volatility: number): CandleData {
  const changePct = drift + randomNormal() * volatility;
  const close = +(prevClose * (1 + changePct / 100)).toFixed(2);
  const range = +(volatility * 0.6).toFixed(2);
  const high = +(Math.max(prevClose, close) * (1 + Math.random() * range / 100)).toFixed(2);
  const low = +(Math.min(prevClose, close) * (1 - Math.random() * range / 100)).toFixed(2);
  const open = prevClose;
  const volume = Math.round(50000 + Math.random() * 200000);
  return { time: Date.now(), open, high, low, close, volume };
}

export interface SimulatorState {
  candles: CandleData[];
  currentPrice: number;
  trend: Trend;
  trendLabel: string;
  changePercent: number;
}

export function useStockSimulator(volatilityMultiplier: number = 1): SimulatorState {
  const multRef = useRef(volatilityMultiplier);
  useEffect(() => { multRef.current = volatilityMultiplier; }, [volatilityMultiplier]);

  const [state, setState] = useState<SimulatorState>(() => {
    const candles: CandleData[] = [];
    let price = INITIAL_PRICE;
    const trend: Trend = 'sideways';
    const cfg = TREND_CONFIG[trend];
    for (let i = 0; i < 40; i++) {
      const c = generateCandle(price, cfg.drift, cfg.volatility * volatilityMultiplier);
      candles.push(c);
      price = c.close;
    }
    return {
      candles,
      currentPrice: price,
      trend,
      trendLabel: cfg.label,
      changePercent: 0,
    };
  });

  const trendRef = useRef<Trend>('sideways');
  const trendCounterRef = useRef(0);
  const priceRef = useRef(INITIAL_PRICE);

  const currentPriceRef = useRef(state.currentPrice);

  useEffect(() => {
    trendRef.current = state.trend;
    currentPriceRef.current = state.currentPrice;
  }, [state.trend, state.currentPrice]);

  useEffect(() => {
    const interval = setInterval(() => {
      trendCounterRef.current++;

      // Change trend every ~12 candles (30s)
      if (trendCounterRef.current >= 12) {
        trendCounterRef.current = 0;
        const newTrend = pickNextTrend(trendRef.current);
        trendRef.current = newTrend;
      }

      const cfg = TREND_CONFIG[trendRef.current];
      const prevClose = currentPriceRef.current;
      const candle = generateCandle(prevClose, cfg.drift, cfg.volatility * multRef.current);

      currentPriceRef.current = candle.close;
      priceRef.current = candle.close;

      setState(prev => {
        const newCandles = [...prev.candles, candle].slice(-CANDLES_TO_KEEP);
        const firstPrice = newCandles[0]?.open || INITIAL_PRICE;
        const changePercent = +(((candle.close - firstPrice) / firstPrice) * 100).toFixed(2);
        return {
          candles: newCandles,
          currentPrice: candle.close,
          trend: trendRef.current,
          trendLabel: TREND_CONFIG[trendRef.current].label,
          changePercent,
        };
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return state;
}
