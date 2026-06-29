'use client';

import { useEffect, useState } from 'react';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

interface VeredictoPanelProps {
  symbol: string;
  detailData: {
    signal: string;
    score: number;
    conviction: string;
    riskLevel: string;
    price: number;
    change: number;
    changePercent: number;
    details: {
      trend: string;
      rsi: number;
      sector: string;
    };
    framework: {
      activeScenarios: string[];
      scenarios: {
        id: string;
        name: string;
        icon: string;
        match: boolean;
        verdict: string | null;
      }[];
      score: number;
    };
    components: {
      analystTarget: number;
    };
  };
  summary: {
    buyZoneLow: number;
    buyZoneHigh: number;
    target1: number;
    target2: number;
    stopLoss: number;
    potentialReturn: number;
    peClassification?: string;
    cashClassification?: string;
    debtClassification?: string;
    peRatio?: number;
    targetMeanPrice?: number;
    targetHighPrice?: number;
    targetLowPrice?: number;
  } | null;
}

function getVerdictColor(signal: string): string {
  return signal === 'BUY' ? '#22C55E' : signal === 'SELL' ? '#EF4444' : '#F59E0B';
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
    return { score, label: 'CALL', color: '#22C55E', desc: 'Tendencia alcista + señal compra, RSI óptimo' };
  if (signal === 'BUY' && trend === 'alcista' && rsi >= 70)
    return { score, label: 'Esperar CALL', color: '#F59E0B', desc: 'BUY + alcista pero RSI sobrecomprado' };
  if (trend === 'alcista' && rsi >= 40 && rsi < 70)
    return { score, label: 'CALL', color: '#22C55E', desc: 'Tendencia alcista, RSI en rango' };
  if (trend === 'alcista' && rsi < 40)
    return { score, label: 'CALL (rebote)', color: '#A78BFA', desc: 'Tendencia alcista, RSI bajo — posible rebote' };
  if (signal === 'HOLD' && trend === 'alcista')
    return { score, label: 'Esperar CALL', color: '#A78BFA', desc: 'Señal HOLD en tendencia alcista' };
  if (trend === 'bajista' && rsi < 30)
    return { score, label: 'CALL (contra)', color: '#A78BFA', desc: 'Sobreventa en tendencia bajista — posible rebote técnico' };
  return { score, label: score >= 65 ? 'CALL' : score >= 45 ? 'CALL dudoso' : 'Evitar CALL', color: '#78716C', desc: '' };
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
    return { score, label: 'PUT', color: '#EF4444', desc: 'Tendencia bajista + señal venta, RSI óptimo' };
  if (signal === 'SELL' && trend === 'bajista' && rsi <= 30)
    return { score, label: 'Esperar PUT', color: '#F59E0B', desc: 'SELL + bajista pero RSI sobrevendido' };
  if (trend === 'bajista' && rsi <= 60 && rsi > 30)
    return { score, label: 'PUT', color: '#EF4444', desc: 'Tendencia bajista, RSI sin sobreventa' };
  if (trend === 'bajista' && rsi < 30)
    return { score, label: 'Esperar PUT', color: '#A78BFA', desc: 'Tendencia bajista pero RSI muy bajo' };
  if (signal === 'HOLD' && trend === 'bajista')
    return { score, label: 'Esperar PUT', color: '#A78BFA', desc: 'Señal HOLD en tendencia bajista' };
  if (trend === 'alcista' && rsi > 70)
    return { score, label: 'PUT (contra)', color: '#A78BFA', desc: 'Sobrecompra en tendencia alcista — posible corrección' };
  return { score, label: score >= 65 ? 'PUT' : score >= 45 ? 'PUT dudoso' : 'Evitar PUT', color: '#78716C', desc: '' };
}

function getEntryAdvice(price: number, buyLow: number, buyHigh: number): { label: string; color: string } {
  if (price >= buyLow && price <= buyHigh) {
    return { label: '✅ EN ZONA DE COMPRA', color: '#22C55E' };
  }
  if (price > buyHigh) {
    return { label: `⏳ Esperar pullback a $${buyLow.toFixed(2)} — $${buyHigh.toFixed(2)}`, color: '#F59E0B' };
  }
  return { label: '📉 Fuera de zona, esperar confirmación', color: '#78716C' };
}

export default function VeredictoPanel({ symbol, detailData, summary }: VeredictoPanelProps) {
  const signal = detailData?.signal || 'HOLD';
  const score = detailData?.score ?? 0;
  const conviction = detailData?.conviction || 'LOW';
  const riskLevel = detailData?.riskLevel || 'MEDIUM';
  const price = detailData?.price ?? 0;
  const change = detailData?.change ?? 0;
  const changePercent = detailData?.changePercent ?? 0;
  const details = detailData?.details || {};
  const framework = detailData?.framework || { activeScenarios: [], scenarios: [], score: 0 };
  const components = detailData?.components || { analystTarget: 0 };
  const trend = details.trend || 'lateral';
  const rsi = details.rsi || 50;
  const vColor = getVerdictColor(signal);

  const [optionsData, setOptionsData] = useState<any>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [expIndex, setExpIndex] = useState(0);

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: F.sizeXs, color: C.textSecondary, marginTop: 2, paddingTop: 4, borderTop: `1px solid ${C.divider}50` }}>
          <span>Coste <strong style={{ color: C.textPrimary }}>${(premium * 100).toFixed(0)}</strong></span>
          <span>B/E {isCall ? '↑' : '↓'} <strong style={{ color: C.textPrimary }}>${breakeven.toFixed(1)}</strong></span>
          <span style={{ color: '#EF4444' }}>SL <strong>${(premium * 100 * 0.5).toFixed(0)}</strong> (-50%)</span>
        </div>
      </div>
    );
  }

  const buyLow = summary?.buyZoneLow ?? price * 0.9;
  const buyHigh = summary?.buyZoneHigh ?? price * 0.97;
  const rawTp1 = summary?.target1 ?? price * 1.15;
  const rawTp2 = summary?.target2 ?? price * 1.25;
  const rawSl = summary?.stopLoss ?? price * 0.85;
  // Sanity clamp: TP cannot be >5x current price, SL cannot be <0
  const tp1 = rawTp1 > 0 && rawTp1 < price * 5 ? rawTp1 : price * 1.15;
  const tp2 = rawTp2 > 0 && rawTp2 < price * 10 ? rawTp2 : tp1 * 1.25;
  const sl = rawSl > 0 && rawSl < price ? rawSl : price * 0.85;
  const potRet = summary?.potentialReturn ?? 0;

  const call = calcCallScore(signal, trend, rsi);
  const put = calcPutScore(signal, trend, rsi);
  const entry = getEntryAdvice(price, buyLow, buyHigh);

  const hasVerdicts = framework.scenarios.some(s => s.match && s.verdict);

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
            background: vColor, color: '#fff', padding: '6px 18px',
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

        {/* Row 2: Entry Zone + TP/SL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Entry Zone */}
          <div style={{
            background: C.bg, borderRadius: R.md, padding: 12,
            border: `1px solid ${entry.color}30`,
          }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Zona de Entrada
            </div>
            <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary }}>
              ${buyLow.toFixed(2)} — ${buyHigh.toFixed(2)}
            </div>
            <div style={{ fontSize: F.sizeXs, color: entry.color, marginTop: 4, fontWeight: 500 }}>
              {entry.label}
            </div>
            <div style={{ marginTop: 6 }}>
              <div style={{ position: 'relative', height: 4, background: C.divider, borderRadius: 2 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${Math.min(100, ((price - buyLow) / (buyHigh - buyLow)) * 100)}%`,
                  background: entry.color, borderRadius: 2,
                }} />
              </div>
            </div>
          </div>

          {/* TP */}
          <div style={{
            background: C.bg, borderRadius: R.md, padding: 12,
            border: '1px solid #22C55E30',
          }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Take Profit
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>TP1</span>
                <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: '#22C55E' }}>
                  ${tp1.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>TP2</span>
                <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: '#16A34A' }}>
                  ${tp2.toFixed(2)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 4 }}>
              Retorno: +{potRet.toFixed(1)}% (TP1)
            </div>
          </div>

          {/* SL */}
          <div style={{
            background: C.bg, borderRadius: R.md, padding: 12,
            border: '1px solid #EF444430',
          }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stop Loss
            </div>
            <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: '#EF4444' }}>
              ${sl.toFixed(2)}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 4 }}>
              Riesgo: {price > 0 ? `-${(((price - sl) / price) * 100).toFixed(1)}%` : '—'}
            </div>
            <div style={{ marginTop: 6 }}>
              <div style={{ position: 'relative', height: 4, background: C.divider, borderRadius: 2 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${Math.min(100, Math.max(0, ((price - sl) / price) * 100))}%`,
                  background: '#EF4444', borderRadius: 2,
                }} />
              </div>
            </div>
          </div>
        </div>

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
              ? (renderContractCard(bestContract(optionsData.nextExpirations[0].calls, true), optionsData.nextExpirations[0], '#22C55E', true)
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
              ? (renderContractCard(bestContract(optionsData.nextExpirations[0].puts, false), optionsData.nextExpirations[0], '#EF4444', false)
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
            border: '1px solid #7C3AED30',
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
                      <span style={{ color: summary.targetMeanPrice > price ? '#22C55E' : '#EF4444', marginLeft: 4 }}>
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
              {framework.scenarios.filter(s => s.match && s.verdict).map(s => (
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

        {optionsLoading && (
          <div style={{ fontSize: F.sizeXs, color: C.textMuted, textAlign: 'center', padding: 12 }}>
            Cargando opciones...
          </div>
        )}
      </div>
    </div>
  );
}
