'use client';

import { useEffect, useState } from 'react';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

interface AIAnalysis {
  verdict: string;
  conviction: string;
  summary: string;
  entry: { ideal: number; stopLoss: number; tp1: number; tp2: number; currentOk: boolean };
  analysis: {
    trend: { signal: string; detail: string; strength?: string };
    ema: { signal: string; detail: string; alignment?: string };
    breakout: { signal: string; detail: string; level?: number };
    volume: { signal: string; detail: string; vsAverage?: number };
    momentum: { signal: string; detail: string; rsi?: number; macd?: string };
    risk: { signal: string; detail: string; atr?: number };
  };
  support: { price: number; type: string }[];
  resistance: { price: number; type: string }[];
  catalysts: string[];
  warnings: string[];
}

interface DetailDataField {
  signal?: string;
  score?: number;
  conviction?: string;
  riskLevel?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  details?: {
    trend?: string;
    rsi?: number;
    sector?: string;
  };
  framework?: {
    activeScenarios?: string[];
    scenarios?: Array<{
      id: string;
      name: string;
      icon: string;
      match: boolean;
      verdict: string | null;
    }>;
    score?: number;
  };
  components?: Record<string, number>;
}

interface VeredictoPanelProps {
  symbol: string;
  detailData: DetailDataField;
  summary: {
    buyZoneLow?: number;
    buyZoneHigh?: number;
    target1?: number;
    target2?: number;
    stopLoss?: number;
    potentialReturn?: number;
    peClassification?: string;
    cashClassification?: string;
    debtClassification?: string;
    peRatio?: number;
    targetMeanPrice?: number;
    targetHighPrice?: number;
    targetLowPrice?: number;
  } | null;
  quote?: {
    regularMarketVolume?: number;
    averageTradingVolume?: number;
    regularMarketPrice?: number;
  } | null;
  technical?: {
    trend?: string;
    rsi?: number;
    sma50?: number;
    sma200?: number;
    support?: number;
    resistance?: number;
    signal?: string;
  } | null;
}

function getVerdictColor(signal: string): string {
  return signal === 'BUY' ? C.positive : signal === 'SELL' ? C.negative : C.warning;
}

function calcCallScore(signal: string, trend: string, rsi: number): { score: number; label: string; color: string; desc: string } {
  let score = 50;
  if (signal === 'BUY') score += 25;
  else if (signal === 'HOLD') score += 5;
  else score -= 15;

  if (trend === 'alcista') score += 25;
  else if (trend === 'lateral') score += 5;
  else score -= 15;

  if (rsi >= 40 && rsi <= 60) score += 20;
  else if (rsi >= 30 && rsi < 40) score += 15;
  else if (rsi > 60 && rsi <= 70) score += 10;
  else if (rsi < 30) score += 5; // oversold bounce opportunity
  else score -= 5;

  score = Math.max(0, Math.min(100, score));

  if (signal === 'BUY' && trend === 'alcista' && rsi < 70)
    return { score, label: 'CALL', color: C.positive, desc: 'Tendencia alcista + señal compra, RSI óptimo' };
  if (signal === 'BUY' && trend === 'alcista' && rsi >= 70)
    return { score, label: 'Esperar CALL', color: C.warning, desc: 'BUY + alcista pero RSI sobrecomprado' };
  if (trend === 'alcista' && rsi >= 40 && rsi < 70)
    return { score, label: 'CALL', color: C.positive, desc: 'Tendencia alcista, RSI en rango' };
  if (trend === 'alcista' && rsi < 40)
    return { score, label: 'CALL (rebote)', color: C.accent, desc: 'Tendencia alcista, RSI bajo — posible rebote' };
  if (signal === 'HOLD' && trend === 'alcista')
    return { score, label: 'Esperar CALL', color: C.accent, desc: 'Señal HOLD en tendencia alcista' };
  if (trend === 'bajista' && rsi < 30)
    return { score, label: 'CALL (contra)', color: C.accent, desc: 'Sobreventa en tendencia bajista — posible rebote técnico' };
  return { score, label: score >= 65 ? 'CALL' : score >= 45 ? 'CALL dudoso' : 'Evitar CALL', color: C.textMuted, desc: '' };
}

function calcPutScore(signal: string, trend: string, rsi: number): { score: number; label: string; color: string; desc: string } {
  let score = 50;
  if (signal === 'SELL') score += 25;
  else if (signal === 'HOLD') score += 5;
  else score -= 15;

  if (trend === 'bajista') score += 25;
  else if (trend === 'lateral') score += 5;
  else score -= 15;

  if (rsi >= 40 && rsi <= 60) score += 20;
  else if (rsi > 60 && rsi <= 70) score += 15;
  else if (rsi >= 30 && rsi < 40) score += 10;
  else if (rsi > 70) score += 5; // overbought = potential drop
  else score -= 5;

  score = Math.max(0, Math.min(100, score));

  if (signal === 'SELL' && trend === 'bajista' && rsi > 30)
    return { score, label: 'PUT', color: C.negative, desc: 'Tendencia bajista + señal venta, RSI óptimo' };
  if (signal === 'SELL' && trend === 'bajista' && rsi <= 30)
    return { score, label: 'Esperar PUT', color: C.warning, desc: 'SELL + bajista pero RSI sobrevendido' };
  if (trend === 'bajista' && rsi <= 60 && rsi > 30)
    return { score, label: 'PUT', color: C.negative, desc: 'Tendencia bajista, RSI sin sobreventa' };
  if (trend === 'bajista' && rsi < 30)
    return { score, label: 'Esperar PUT', color: C.accent, desc: 'Tendencia bajista pero RSI muy bajo' };
  if (signal === 'HOLD' && trend === 'bajista')
    return { score, label: 'Esperar PUT', color: C.accent, desc: 'Señal HOLD en tendencia bajista' };
  if (trend === 'alcista' && rsi > 70)
    return { score, label: 'PUT (contra)', color: C.accent, desc: 'Sobrecompra en tendencia alcista — posible corrección' };
  return { score, label: score >= 65 ? 'PUT' : score >= 45 ? 'PUT dudoso' : 'Evitar PUT', color: C.textMuted, desc: '' };
}

function getEntryAdvice(price: number, buyLow: number, buyHigh: number): { label: string; color: string } {
  if (price >= buyLow && price <= buyHigh) {
    return { label: '✅ EN ZONA DE COMPRA', color: C.positive };
  }
  if (price > buyHigh) {
    return { label: `⏳ Esperar pullback a $${buyLow.toFixed(2)} — $${buyHigh.toFixed(2)}`, color: C.warning };
  }
  return { label: '📉 Fuera de zona, esperar confirmación', color: C.textMuted };
}

export default function VeredictoPanel({ symbol, detailData, summary, quote, technical }: VeredictoPanelProps) {
  const signal = detailData?.signal || 'HOLD';
  const score = detailData?.score ?? 0;
  const conviction = detailData?.conviction || 'LOW';
  const riskLevel = detailData?.riskLevel || 'MEDIUM';
  const price = detailData?.price ?? 0;
  const change = detailData?.change ?? 0;
  const changePercent = detailData?.changePercent ?? 0;
  const details = detailData?.details || {};
  const framework = detailData?.framework || { activeScenarios: [], scenarios: [], score: 0 };
  const trend = details?.trend || 'lateral';
  const rsi = details?.rsi ?? 50;
  const vColor = getVerdictColor(signal);

  const [optionsData, setOptionsData] = useState<any>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [expIndex, setExpIndex] = useState(0);
  const [ai, setAi] = useState<AIAnalysis | null>(null);

  useEffect(() => {
    if (!symbol) return;
    fetch(`/api/v1/ai/analysis?symbol=${symbol}`)
      .then(r => r.json())
      .then(json => { if (json?.success && json.analysis) setAi(json.analysis); })
      .catch(() => {});
  }, [symbol]);

  // ─── Pre-entry Checklist ────────────────────────────────────
  const itemTrend = trend ?? technical?.trend ?? 'lateral';
  const isBullish = itemTrend === 'alcista';
  const vol = quote?.regularMarketVolume ?? 0;
  const avgVol = quote?.averageTradingVolume ?? vol;
  const volumeAboveAvg = avgVol > 0 && vol > avgVol;
  const isBreakout = price >= (technical?.resistance ?? price * 1.05) * 0.985;
  const resLeveL = technical?.resistance ?? price * 1.08;
  const noResistanceNear = price < resLeveL * 0.97;
  const rrRatio = (() => {
    const isBearish = signal === 'SELL';
    const effTp1 = isBearish ? price * 0.85 : (summary?.target1 ?? price * 1.15);
    const effSl = isBearish ? price * 1.15 : (summary?.stopLoss ?? price * 0.85);
    const gain = Math.abs(effTp1 - price);
    const loss = Math.abs(effSl - price);
    return loss > 0 ? gain / loss : 0;
  })();
  const rrOk = rrRatio >= 2;

  const optContracts = optionsData?.nextExpirations?.[0];
  const bestCall = optContracts ? bestContract(optContracts.calls, true) : null;
  const bestPut = optContracts ? bestContract(optContracts.puts, false) : null;
  const bestOpt = bestCall?.delta >= 0.2 && bestCall?.delta <= 0.75 ? bestCall : bestPut?.delta <= -0.2 && bestPut?.delta >= -0.75 ? bestPut : null;
  const deltaIdeal = bestOpt != null && Math.abs(bestOpt.delta ?? 0) >= 0.20 && Math.abs(bestOpt.delta ?? 0) <= 0.75;
  const oiSuficiente = (bestOpt?.openInterest ?? 0) >= 100;

  interface ChecklistItem {
    id: string;
    label: string;
    auto: boolean;
    check: boolean;
  }

  const defaultChecks: ChecklistItem[] = [
    { id: 'bullish', label: 'Mercado alcista', auto: true, check: isBullish },
    { id: 'ema8', label: 'Precio sobre EMA 8', auto: false, check: false },
    { id: 'ema8-21', label: 'EMA 8 > EMA 21', auto: false, check: false },
    { id: 'volume', label: 'Volumen superior al promedio', auto: true, check: volumeAboveAvg },
    { id: 'breakout', label: 'Breakout confirmado', auto: true, check: isBreakout },
    { id: 'rr', label: 'Riesgo/Recompensa > 1:2', auto: true, check: rrOk },
    { id: 'delta', label: 'Delta ideal', auto: true, check: deltaIdeal },
    { id: 'oi', label: 'OI suficiente', auto: true, check: oiSuficiente },
    { id: 'resistance', label: 'Sin resistencia inmediata', auto: true, check: noResistanceNear },
  ];

  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultChecks);

  // Sync auto items when data changes
  useEffect(() => {
    setChecklist(prev => prev.map(item => {
      if (!item.auto) return item;
      switch (item.id) {
        case 'bullish': return { ...item, check: isBullish };
        case 'volume': return { ...item, check: volumeAboveAvg };
        case 'breakout': return { ...item, check: isBreakout };
        case 'rr': return { ...item, check: rrOk };
        case 'delta': return { ...item, check: deltaIdeal };
        case 'oi': return { ...item, check: oiSuficiente };
        case 'resistance': return { ...item, check: noResistanceNear };
        default: return item;
      }
    }));
  }, [isBullish, volumeAboveAvg, isBreakout, rrOk, deltaIdeal, oiSuficiente, noResistanceNear, optionsData]);

  const checkedCount = checklist.filter(i => i.check).length;
  const totalItems = checklist.length;

  const checklistResult = (() => {
    if (checkedCount >= 9) return { emoji: '🟢', label: 'Entraría', color: C.positive };
    if (checkedCount >= 7) return { emoji: '🟡', label: 'Esperaría confirmación', color: C.warning };
    return { emoji: '🔴', label: 'No operaría', color: C.negative };
  })();

  const toggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, check: !item.check } : item
    ));
  };

  const resetChecklist = () => {
    setChecklist(defaultChecks.map(item => {
      if (!item.auto) return { ...item, check: false };
      switch (item.id) {
        case 'bullish': return { ...item, check: isBullish };
        case 'volume': return { ...item, check: volumeAboveAvg };
        case 'breakout': return { ...item, check: isBreakout };
        case 'rr': return { ...item, check: rrOk };
        case 'delta': return { ...item, check: deltaIdeal };
        case 'oi': return { ...item, check: oiSuficiente };
        case 'resistance': return { ...item, check: noResistanceNear };
        default: return item;
      }
    }));
  };

  useEffect(() => {
    if (!symbol) return;
    setOptionsLoading(true);
    fetch(`/api/options-chain?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => { setOptionsData(d); setOptionsLoading(false); })
      .catch(() => setOptionsLoading(false));
  }, [symbol]);

  function approxDelta(strike: number, isCall: boolean): number {
    if (!price || !strike) return 0;
    const m = price / strike;
    if (isCall) {
      if (m > 1.1) return Math.min(0.95, 0.5 + (m - 1) * 2);
      if (m < 0.9) return Math.max(0.05, 0.5 - (1 - m) * 2);
      return 0.4 + (m - 0.9) * 1.5;
    } else {
      if (m < 0.9) return Math.max(-0.95, -0.5 + (1 - m) * 2);
      if (m > 1.1) return Math.min(-0.05, -0.5 - (m - 1) * 2);
      return -0.4 - (m - 0.9) * 1.5;
    }
  }

  function bestContract(contracts: any[], isCall: boolean): any {
    const withVol = contracts.filter((c: any) => (c.openInterest || 0) > 0 || (c.volume || 0) > 0);
    const pool = withVol.length > 0 ? withVol : contracts;
    const scored = pool.map((c: any) => {
      const strike = c.strike;
      const dist = Math.abs(strike - price) / price;
      const oi = c.openInterest || 0;
      const vol = c.volume || 0;
      const moneyness = isCall
        ? (strike - price) / price
        : (price - strike) / price;
      const isITM = isCall ? strike < price : strike > price;
      const farITMpenalty = isITM && moneyness < -0.1 ? Math.abs(moneyness + 0.1) * 150 : 0;
      const oiVolScore = Math.min(oi + vol, 20000) / 20000 * 40;
      const score = -dist * 80 + oiVolScore - farITMpenalty + (moneyness > 0 && moneyness < 0.05 ? 15 : 0);
      return { ...c, _score: score };
    });
    scored.sort((a: any, b: any) => b._score - a._score);
    return scored[0] || null;
  }

  function fmtNum(n: number | undefined | null): string {
    return n != null ? n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n) : '—';
  }

  function renderContractCard(best: any, exp: any, color: string, isCall: boolean) {
    if (!best) return null;
    const d = (best.delta ?? approxDelta(best.strike, isCall));
    const premium = best.lastPrice || 0;
    const breakeven = isCall ? (best.strike + premium) : (best.strike - premium);
    const slPremium = premium * 0.5;
    const slStock = breakeven * (isCall ? 0.95 : 1.05);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: F.sizeLg, fontWeight: 700, color }}>${best.strike}</span>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{exp.date.slice(5)} ({exp.daysToExpiration}d)</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: F.sizeXs, color: C.textSecondary }}>
          <span>Last <strong style={{ color: C.textPrimary }}>${premium.toFixed(2)}</strong></span>
          <span>Δ <strong style={{ color: C.textPrimary }}>{d.toFixed(2)}</strong></span>
          <span>OI <strong style={{ color: C.textPrimary }}>{fmtNum(best.openInterest)}</strong></span>
          <span>Vol <strong style={{ color: C.textPrimary }}>{fmtNum(best.volume)}</strong></span>
          <span>IV <strong style={{ color: C.textPrimary }}>{(best.impliedVolatility * 100).toFixed(best.impliedVolatility < 0.01 ? 3 : 1)}%</strong></span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: F.sizeXs, color: C.textSecondary, marginTop: 2, paddingTop: 4, borderTop: `1px solid ${C.divider50}` }}>
          <span>Coste <strong style={{ color: C.textPrimary }}>${(premium * 100).toFixed(0)}</strong></span>
          <span>B/E {isCall ? '↑' : '↓'} <strong style={{ color: C.textPrimary }}>${breakeven.toFixed(1)}</strong></span>
          <span style={{ color: C.negative }}>SL <strong>${(premium * 100 * 0.5).toFixed(0)}</strong> (-50%)</span>
        </div>
      </div>
    );
  }

  const buyLow = summary?.buyZoneLow ?? price * 0.9;
  const buyHigh = summary?.buyZoneHigh ?? price * 0.97;

  // Same computation chain as StockDetailPanel Configuración de Operación
  const p = price || 0;
  const aiEntry = ai?.entry?.ideal || 0;
  const aiStop = ai?.entry?.stopLoss || 0;
  const aiTp1 = ai?.entry?.tp1 || 0;
  const aiTp2 = ai?.entry?.tp2 || 0;
  const sumEntry = summary?.buyZoneLow || 0;
  const sumStop = summary?.stopLoss || 0;
  const sumTp1 = summary?.target1 || 0;
  const sumTp2 = summary?.target2 || 0;
  const techSupport = technical?.support || 0;
  const techResistance = technical?.resistance || 0;

  const entry = aiEntry || sumEntry || (techSupport > 0 && techSupport < p ? techSupport : 0);
  const stop = aiStop || sumStop || (techSupport > 0 && techSupport < p ? +(techSupport * 0.97).toFixed(2) : 0);

  const validTp1 = p > 0 && sumTp1 > 0 && sumTp1 < p * 5 ? sumTp1 : 0;
  const validTp2 = p > 0 && sumTp2 > 0 && sumTp2 < p * 10 ? sumTp2 : 0;
  const tp1 = aiTp1 || validTp1 || (techResistance > 0 && techResistance > p ? techResistance : +(p * 1.15).toFixed(2));
  const tp2 = aiTp2 || validTp2 || (techResistance > 0 && techResistance > p ? +(techResistance * 1.05).toFixed(2) : +(tp1 * 1.25).toFixed(2));
  const sl = stop;

  const potRet = p > 0 ? ((tp1 - p) / p) * 100 : 0;

  const call = calcCallScore(signal, trend, rsi);
  const put = calcPutScore(signal, trend, rsi);
  const entryAdvice = getEntryAdvice(price, buyLow, buyHigh);

  const hasVerdicts = (framework.scenarios ?? []).some(s => s.match && s.verdict);

  const signalLabel = signal === 'BUY' ? 'COMPRAR' : signal === 'SELL' ? 'VENDER' : 'MANTENER';
  const changeStr = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  const changePctStr = changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${vColor}40`, borderRadius: R.xl, marginTop: 16, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${vColor}15, ${C.bg})`,
        padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚖️</span>
          <span style={{ fontSize: F.sizeLg, fontWeight: 700, color: C.textPrimary }}>VEREDICTO</span>
          <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>·</span>
          <span style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.accent }}>{symbol}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: F.sizeLg, fontWeight: 700, color: C.textPrimary }}>
            ${price.toFixed(2)}
          </span>
          <span style={{
            fontSize: F.sizeSm, fontWeight: 600,
            color: change >= 0 ? C.positive : C.negative,
          }}>
            {changeStr} ({changePctStr})
          </span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Row 1: Verdict + Confidence */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '12px 16px', background: `${vColor}10`,
          borderRadius: R.lg, marginBottom: 16,
        }}>
          <span style={{
            background: vColor, color: C.textPrimary, padding: '6px 18px',
            borderRadius: R.full, fontWeight: 700, fontSize: F.sizeLg,
            letterSpacing: '0.5px',
          }}>
            {signalLabel}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
                Confianza <strong style={{ color: C.textPrimary }}>{conviction}</strong>
              </span>
              <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
                Score <strong style={{ color: C.textPrimary }}>{score}/100</strong>
              </span>
              <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
                Riesgo <strong style={{ color: riskLevel === 'LOW' ? C.positive : riskLevel === 'HIGH' ? C.negative : C.textPrimary }}>
                  {riskLevel === 'LOW' ? 'Bajo' : riskLevel === 'HIGH' ? 'Alto' : 'Medio'}
                </strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
                📈 <strong style={{ color: trend === 'alcista' ? C.positive : trend === 'bajista' ? C.negative : C.textMuted }}>
                  {trend === 'alcista' ? 'Alcista' : trend === 'bajista' ? 'Bajista' : 'Lateral'}
                </strong>
              </span>
              <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
                RSI <strong style={{
                  color: rsi >= 70 ? C.negative : rsi <= 30 ? C.positive : C.textPrimary,
                }}>{rsi.toFixed(0)}</strong>
              </span>
              <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
                Sector <strong style={{ color: C.textPrimary }}>{details.sector || '—'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Entry Zone + TP/SL (direction-aware) */}
        {(() => {
          const isBearish = signal === 'SELL';
          const effTp1 = isBearish ? price * 0.85 : tp1;
          const effTp2 = isBearish ? price * 0.80 : tp2;
          const effSl = isBearish ? price * 1.15 : sl;
          const effPotRet = isBearish
            ? ((price - effTp1) / price) * 100
            : ((effTp1 - price) / price) * 100;
          const effRiskPct = isBearish
            ? ((effSl - price) / price) * 100
            : ((price - effSl) / price) * 100;
          const riskBarPct = Math.min(100, Math.max(0, effRiskPct));
          const tpLabel = isBearish ? 'Cover Target' : 'Take Profit';
          const tpColor = isBearish ? C.negative : C.positive;
          const entryLabel = isBearish ? 'Zona de Venta' : 'Zona de Entrada';

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              {/* Entry Zone — same original style for BUY/HOLD */}
              <div style={{
                background: C.bg, borderRadius: R.md, padding: 12,
                border: isBearish ? `1px solid ${C.negative30}` : `1px solid ${entryAdvice.color}30`,
              }}>
                <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {entryLabel}
                </div>
                {isBearish ? (
                  <>
                    <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary }}>
                      <span style={{ color: C.negative }}>Short</span> @ ${price.toFixed(2)}
                    </div>
                    <div style={{ fontSize: F.sizeXs, color: C.negative, marginTop: 4, fontWeight: 500 }}>
                      Vender en corto ahora
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary }}>
                      ${buyLow.toFixed(2)} — ${buyHigh.toFixed(2)}
                    </div>
                    <div style={{ fontSize: F.sizeXs, color: entryAdvice.color, marginTop: 4, fontWeight: 500 }}>
                      {entryAdvice.label}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <div style={{ position: 'relative', height: 4, background: C.divider, borderRadius: 2 }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%',
                          width: `${Math.min(100, ((price - buyLow) / (buyHigh - buyLow)) * 100)}%`,
                          background: entryAdvice.color, borderRadius: 2,
                        }} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* TP / Cover Target */}
              <div style={{
                background: C.bg, borderRadius: R.md, padding: 12,
                border: `1px solid ${tpColor}30`,
              }}>
                <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {tpLabel}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>TP1</span>
                    <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: tpColor }}>
                      ${effTp1.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>TP2</span>
                    <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: tpColor }}>
                      ${effTp2.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 4 }}>
                  {isBearish ? 'Ganancia' : 'Retorno'}: +{effPotRet.toFixed(1)}% (TP1)
                </div>
              </div>

              {/* SL */}
              <div style={{
                background: C.bg, borderRadius: R.md, padding: 12,
                border: `1px solid ${C.negative30}`,
              }}>
                <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Stop Loss
                </div>
                <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.negative }}>
                  ${effSl.toFixed(2)}
                </div>
                <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 4 }}>
                  Riesgo: {price > 0 ? `-${effRiskPct.toFixed(1)}%` : '—'}
                </div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ position: 'relative', height: 4, background: C.divider, borderRadius: 2 }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${riskBarPct}%`,
                      background: C.negative, borderRadius: 2,
                    }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {/* Nota informativa: zona de compra para portafolio */}
        {signal === 'SELL' && (
          <div style={{
            fontSize: F.sizeXs, color: C.textMuted, textAlign: 'center',
            padding: '6px 12px', marginBottom: 12,
            border: `1px dashed ${C.divider}`, borderRadius: R.md,
          }}>
            💡 Si deseas comprar la acción para portafolio, la zona de compra recomendada es
            {' '}<strong style={{ color: C.accent }}>${buyLow.toFixed(2)} — ${buyHigh.toFixed(2)}</strong>
            {' '}(esperar pullback). El veredicto VENDER aplica para trading direccional de corto plazo.
          </div>
        )}

        {/* Row 3: Options Contracts (CALL | PUT) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.bg, borderRadius: R.md, padding: 12, border: `1px solid ${call.color}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: F.sizeXs, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📈 CALL <span style={{ color: call.color, fontWeight: 700 }}>{call.score}</span>
              </div>
              <span style={{ fontSize: F.sizeXs, color: call.color, fontWeight: 700 }}>{call.label}</span>
            </div>
            {optionsData?.nextExpirations?.[0]
              ? (renderContractCard(bestContract(optionsData.nextExpirations[0].calls, true), optionsData.nextExpirations[0], C.positive, true)
                 || <div style={{ fontSize: F.sizeXs, color: C.textSecondary }}>{call.desc || 'Sin contratos cercanos'}</div>)
              : (<>
                {call.desc && <div style={{ fontSize: F.sizeXs, color: C.textSecondary, marginTop: 2 }}>{call.desc}</div>}
                <div style={{ marginTop: 6 }}>
                  <div style={{ position: 'relative', height: 3, background: C.divider, borderRadius: 2 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${call.score}%`, background: call.color, borderRadius: 2, transition: T.normal }} />
                  </div>
                </div>
              </>)}
          </div>
          <div style={{ background: C.bg, borderRadius: R.md, padding: 12, border: `1px solid ${put.color}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: F.sizeXs, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📉 PUT <span style={{ color: put.color, fontWeight: 700 }}>{put.score}</span>
              </div>
              <span style={{ fontSize: F.sizeXs, color: put.color, fontWeight: 700 }}>{put.label}</span>
            </div>
            {optionsData?.nextExpirations?.[0]
              ? (renderContractCard(bestContract(optionsData.nextExpirations[0].puts, false), optionsData.nextExpirations[0], C.negative, false)
                 || <div style={{ fontSize: F.sizeXs, color: C.textSecondary }}>{put.desc || 'Sin contratos cercanos'}</div>)
              : (<>
                {put.desc && <div style={{ fontSize: F.sizeXs, color: C.textSecondary, marginTop: 2 }}>{put.desc}</div>}
                <div style={{ marginTop: 6 }}>
                  <div style={{ position: 'relative', height: 3, background: C.divider, borderRadius: 2 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${put.score}%`, background: put.color, borderRadius: 2, transition: T.normal }} />
                  </div>
                </div>
              </>)}
          </div>
        </div>

        {/* Classifications row */}
        {summary && (summary.peClassification || summary.cashClassification || summary.debtClassification || summary.peRatio || summary?.targetMeanPrice) && (
          <div style={{
            background: C.bg, borderRadius: R.md, padding: 12, marginBottom: 16,
            border: `1px solid ${C.accent30}`,
          }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Clasificaciones
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {summary?.peClassification && (
                <div style={{ fontSize: F.sizeXs }}>
                  <span style={{ color: C.textMuted }}>PE: </span>
                  <span style={{ color: C.textSecondary }}>{summary.peClassification}</span>
                </div>
              )}
              {summary?.cashClassification && (
                <div style={{ fontSize: F.sizeXs }}>
                  <span style={{ color: C.textMuted }}>Cash: </span>
                  <span style={{ color: C.textSecondary }}>{summary.cashClassification}</span>
                </div>
              )}
              {summary?.debtClassification && (
                <div style={{ fontSize: F.sizeXs }}>
                  <span style={{ color: C.textMuted }}>Debt: </span>
                  <span style={{ color: C.textSecondary }}>{summary.debtClassification}</span>
                </div>
              )}
              {summary?.peRatio && (
                <div style={{ fontSize: F.sizeXs }}>
                  <span style={{ color: C.textMuted }}>P/E: </span>
                  <span style={{ color: C.textSecondary }}>{summary.peRatio.toFixed(1)}</span>
                </div>
              )}
              {summary?.targetMeanPrice && summary.targetMeanPrice > 0 ? (
                <div style={{ fontSize: F.sizeXs }}>
                  <span style={{ color: C.textMuted }}>Target: </span>
                  <span style={{ color: C.textSecondary }}>
                    ${summary.targetMeanPrice.toFixed(2)}
                    {price > 0 && (
                      <span style={{ color: summary.targetMeanPrice > price ? C.positive : C.negative, marginLeft: 4 }}>
                        ({((summary.targetMeanPrice - price) / price * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: F.sizeXs }}><span style={{ color: C.textMuted }}>Target: </span><span style={{ color: C.textSecondary }}>—</span></div>
              )}
              {summary?.targetHighPrice && summary.targetHighPrice > 0 && (
                <div style={{ fontSize: F.sizeXs }}>
                  <span style={{ color: C.textMuted }}>Rango: </span>
                  <span style={{ color: C.textSecondary }}>${summary.targetLowPrice?.toFixed(2)} — ${summary.targetHighPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Row 4: Framework Scenarios */}
        {hasVerdicts && (
          <div style={{
            background: C.bg, borderRadius: R.md, padding: '10px 12px',
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Escenarios
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(framework.scenarios ?? []).filter(s => s.match && s.verdict).map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: F.sizeXs,
                  color: C.textSecondary,
                }}>
                  <span>{s.icon}</span>
                  <span style={{ fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap' }}>{s.name}:</span>
                  <span>{s.verdict}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── CHECKLIST PRE-ENTRY ─── */}
        <div style={{
          background: C.bg, borderRadius: R.lg, padding: 14, marginTop: 16,
          border: `1px solid ${checklistResult.color}40`,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>
                CHECKLIST PRE-ENTRADA
              </span>
            </div>
            <button
              onClick={resetChecklist}
              style={{
                background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer',
                fontSize: '11px', padding: '2px 6px',
              }}
              title="Resetear checklist"
            >
              ↻ Reset
            </button>
          </div>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checklist.map(item => {
              const bgColor = item.check ? `${C.positive15}` : 'transparent';
              const borderColor = item.check ? `${C.positive30}` : C.border;
              return (
                <div
                  key={item.id}
                  onClick={() => toggleChecklist(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 10px', borderRadius: R.sm,
                    background: bgColor, border: `1px solid ${borderColor}`,
                    cursor: 'pointer', transition: T.normal,
                    userSelect: 'none',
                  }}
                >
                  <span style={{
                    fontSize: '14px', flexShrink: 0,
                    color: item.check ? C.positive : C.textMuted,
                  }}>
                    {item.check ? '☑' : '☐'}
                  </span>
                  <span style={{
                    flex: 1, fontSize: F.sizeSm,
                    color: item.check ? C.textPrimary : C.textSecondary,
                    fontWeight: item.check ? 600 : 400,
                  }}>
                    {item.label}
                  </span>
                  {item.auto && (
                    <span style={{
                      fontSize: '10px', color: C.textMuted,
                      background: C.divider, padding: '1px 5px',
                      borderRadius: R.full,
                    }}>
                      auto
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.divider}`,
          }}>
            <span style={{
              fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary,
            }}>
              {checkedCount}/{totalItems}
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                fontSize: F.sizeSm, fontWeight: 700,
                color: checklistResult.color,
              }}>
                {checklistResult.emoji} {checklistResult.label}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 8, position: 'relative', height: 4, background: C.divider, borderRadius: 2 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${(checkedCount / totalItems) * 100}%`,
              background: checklistResult.color, borderRadius: 2,
              transition: T.normal,
            }} />
          </div>
        </div>

        {optionsLoading && (
          <div style={{ fontSize: F.sizeXs, color: C.textMuted, textAlign: 'center', padding: 12 }}>
            Cargando opciones...
          </div>
        )}
      </div>
    </div>
  );
}
