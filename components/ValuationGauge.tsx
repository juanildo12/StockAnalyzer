'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R, font as F, spacing as S, transition as T } from '@/src/utils/webTheme';

interface ValuationData {
  currentPrice: number;
  ema200: number | null;
  targetMean: number;
  targetLow: number;
  targetHigh: number;
  peRatio: number | null;
  avgPe: number | null;
  fcfYield: number | null;
  discountScore: number;
  rsi: number | null;
  analystCount: number;
}

interface ValuationGaugeProps {
  symbol: string;
}

function getValuationLabel(diffPct: number): { text: string; color: string; bg: string; border: string } {
  if (diffPct <= -20) return { text: 'MUY BARATA', color: C.positive, bg: C.positiveBg, border: C.positiveBorder };
  if (diffPct <= -10) return { text: 'BARATA', color: C.positive, bg: C.positiveBg, border: C.positiveBorder };
  if (diffPct <= -3) return { text: 'BAJO LA EMA200', color: '#34D399', bg: C.positiveBg, border: C.positiveBorder };
  if (diffPct <= 3) return { text: 'EN LA MEDIA', color: C.warning, bg: C.warningBg, border: C.warningBorder };
  if (diffPct <= 10) return { text: 'SOBRE LA EMA200', color: C.warning, bg: C.warningBg, border: C.warningBorder };
  if (diffPct <= 20) return { text: 'CARA', color: C.negative, bg: C.negativeBg, border: C.negativeBorder };
  return { text: 'MUY CARA', color: C.negative, bg: C.negativeBg, border: C.negativeBorder };
}

export default function ValuationGauge({ symbol }: ValuationGaugeProps) {
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?symbol=${symbol}`);
      if (!res.ok) return;
      const json = await res.json();
      const q = json.quote || {};
      const s = json.summary || {};
      const t = json.technical || {};

      const currentPrice = q.regularMarketPrice || 0;
      const ema200 = t.ema200 || t.sma200 || null;
      const targetMean = s.targetMeanPrice || currentPrice;
      const targetLow = s.targetLowPrice || targetMean * 0.85;
      const targetHigh = s.targetHighPrice || targetMean * 1.15;
      const peRatio = q.peRatio || s.peRatio || null;
      const avgPe = s.avgPe6Months || null;
      const rsi = t.rsi || null;
      const analystCount = q.targetAnalystCount || s.analystCount || 0;

      let fcfYield: number | null = null;
      if (s.freeCashflow && s.marketCap && s.marketCap > 0) {
        fcfYield = (s.freeCashflow / s.marketCap) * 100;
      }

      setData({
        currentPrice, ema200, targetMean, targetLow, targetHigh,
        peRatio, avgPe, fcfYield, discountScore: json.discountScore ?? 0,
        rsi, analystCount,
      });
    } catch {}
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl,
        padding: S.xl,
      }}>
        <div style={{
          height: 200, borderRadius: R.lg,
          background: `linear-gradient(90deg, ${C.bgElevated} 25%, ${C.bgCardHover} 50%, ${C.bgElevated} 75%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        }} />
      </div>
    );
  }

  if (!data || data.currentPrice <= 0 || !data.ema200) return null;

  const { currentPrice, ema200, targetMean, targetLow, targetHigh } = data;

  // Price vs EMA200 percentage
  const priceDiffPct = ((currentPrice - ema200) / ema200) * 100;
  const label = getValuationLabel(priceDiffPct);

  // Gauge range: centered on EMA200
  const deviation = Math.abs(priceDiffPct);
  const rangePadding = Math.max(deviation * 1.5, 15);
  const rangeLow = ema200 * (1 - rangePadding / 100);
  const rangeHigh = ema200 * (1 + rangePadding / 100);
  const range = rangeHigh - rangeLow;

  // Positions in gauge (0-100%)
  const pricePct = Math.max(0, Math.min(100, ((currentPrice - rangeLow) / range) * 100));
  const ema200Pct = Math.max(0, Math.min(100, ((ema200 - rangeLow) / range) * 100));
  const targetPct = Math.max(0, Math.min(100, ((targetMean - rangeLow) / range) * 100));

  // Fair value zone: ±5% around EMA200
  const fairZoneLow = ema200 * 0.95;
  const fairZoneHigh = ema200 * 1.05;
  const fairZoneStart = Math.max(0, ((fairZoneLow - rangeLow) / range) * 100);
  const fairZoneEnd = Math.min(100, ((fairZoneHigh - rangeLow) / range) * 100);

  const gaugeY = 55;
  const gaugeH = 16;
  const gaugeX = 20;
  const gaugeW = 280;

  return (
    <div
      style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl,
        padding: S.xl, transition: T.normal,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: F.sizeLg }}>&#128200;</span>
          <span style={{ fontSize: F.sizeBase, fontWeight: 600, color: C.textPrimary, fontFamily: F.family }}>
            Precio vs EMA 200
          </span>
        </div>
        <div style={{
          padding: `${S.xxs} ${S.sm}`, borderRadius: R.full,
          background: label.bg, border: `1px solid ${label.border}`,
          fontSize: F.sizeXs, fontWeight: 700, color: label.color,
          fontFamily: F.family, letterSpacing: '0.05em',
        }}>
          {label.text}
        </div>
      </div>

      {/* Price Diff */}
      <div style={{ marginBottom: S.sm, textAlign: 'center' }}>
        <span style={{
          fontSize: '28px', fontWeight: 800, color: label.color,
          fontFamily: F.mono, letterSpacing: '-0.02em',
        }}>
          {priceDiffPct >= 0 ? '+' : ''}{priceDiffPct.toFixed(1)}%
        </span>
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: S.xxs, fontFamily: F.family }}>
          EMA 200: ${ema200.toFixed(2)}
        </div>
      </div>

      {/* SVG Gauge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: S.md }}>
        <svg viewBox="0 0 320 130" width="100%" style={{ maxWidth: 400 }}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={C.positive} stopOpacity={0.8} />
              <stop offset="30%" stopColor="#34D399" stopOpacity={0.6} />
              <stop offset="50%" stopColor={C.warning} stopOpacity={0.6} />
              <stop offset="70%" stopColor="#FB923C" stopOpacity={0.6} />
              <stop offset="100%" stopColor={C.negative} stopOpacity={0.8} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Scale labels */}
          <text x={gaugeX} y={gaugeY + gaugeH + 28} textAnchor="start" fill={C.textMuted} fontSize={10} fontFamily={F.mono}>
            ${rangeLow.toFixed(0)}
          </text>
          <text x={gaugeX + gaugeW} y={gaugeY + gaugeH + 28} textAnchor="end" fill={C.textMuted} fontSize={10} fontFamily={F.mono}>
            ${rangeHigh.toFixed(0)}
          </text>

          {/* Track */}
          <rect x={gaugeX} y={gaugeY} width={gaugeW} height={gaugeH} rx={gaugeH / 2}
            fill="url(#gaugeGrad)" opacity={hovered ? 1 : 0.7} />

          {/* Fair value zone (±5% of EMA200) */}
          <rect
            x={gaugeX + (fairZoneStart / 100) * gaugeW}
            y={gaugeY - 3}
            width={Math.max(0, ((fairZoneEnd - fairZoneStart) / 100) * gaugeW)}
            height={gaugeH + 6}
            rx={4}
            fill={C.warning}
            opacity={0.12}
          />

          {/* EMA200 line (center = fair value) */}
          <line
            x1={gaugeX + (ema200Pct / 100) * gaugeW}
            y1={gaugeY - 10}
            x2={gaugeX + (ema200Pct / 100) * gaugeW}
            y2={gaugeY + gaugeH + 10}
            stroke={C.warning} strokeWidth={2} opacity={0.8}
          />
          <text x={gaugeX + (ema200Pct / 100) * gaugeW} y={gaugeY + gaugeH + 22}
            textAnchor="middle" fill={C.warning} fontSize={9} fontWeight={600} fontFamily={F.family}>
            EMA200
          </text>

          {/* Analyst target line */}
          <line
            x1={gaugeX + (targetPct / 100) * gaugeW}
            y1={gaugeY - 8}
            x2={gaugeX + (targetPct / 100) * gaugeW}
            y2={gaugeY + gaugeH + 8}
            stroke={C.accent} strokeWidth={1} opacity={0.5} strokeDasharray="4,3"
          />
          <text x={gaugeX + (targetPct / 100) * gaugeW} y={gaugeY - 14}
            textAnchor="middle" fill={C.accent} fontSize={8} fontFamily={F.family}>
            Target
          </text>

          {/* Price marker - triangle */}
          <polygon
            points={`
              ${gaugeX + (pricePct / 100) * gaugeW},${gaugeY - 16}
              ${gaugeX + (pricePct / 100) * gaugeW - 5},${gaugeY - 22}
              ${gaugeX + (pricePct / 100) * gaugeW + 5},${gaugeY - 22}
            `}
            fill={label.color}
            filter="url(#glow)"
          />

          {/* Price dot */}
          <circle
            cx={gaugeX + (pricePct / 100) * gaugeW}
            cy={gaugeY + gaugeH / 2}
            r={6}
            fill={C.bgCard}
            stroke={label.color}
            strokeWidth={2.5}
            filter="url(#glow)"
          />

          {/* Price label */}
          <text x={gaugeX + (pricePct / 100) * gaugeW} y={gaugeY - 28}
            textAnchor="middle" fill={label.color} fontSize={12} fontWeight={700} fontFamily={F.mono}>
            ${currentPrice.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Metrics row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: S.sm,
        borderTop: `1px solid ${C.border}`, paddingTop: S.md,
      }}>
        <MetricItem
          label="RSI"
          value={data.rsi ? `${data.rsi.toFixed(0)}` : '—'}
          highlight={data.rsi ? (data.rsi < 30 ? C.positive : data.rsi > 70 ? C.negative : C.warning) : undefined}
        />
        <MetricItem
          label="P/E"
          value={data.peRatio ? `${data.peRatio.toFixed(1)}` : '—'}
          sub={data.avgPe ? `Prom: ${data.avgPe.toFixed(1)}` : undefined}
          highlight={data.peRatio && data.avgPe ? (data.peRatio < data.avgPe * 0.9 ? C.positive : data.peRatio > data.avgPe * 1.1 ? C.negative : C.warning) : undefined}
        />
        <MetricItem
          label="FCF Yield"
          value={data.fcfYield ? `${data.fcfYield.toFixed(1)}%` : '—'}
          highlight={data.fcfYield ? (data.fcfYield > 8 ? C.positive : data.fcfYield < 3 ? C.negative : C.warning) : undefined}
        />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: S.lg, marginTop: S.md,
        fontSize: F.sizeXs, color: C.textMuted, fontFamily: F.family,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: S.xs }}>
          <span style={{ width: 12, height: 2, background: C.warning, display: 'inline-block' }} />
          EMA 200
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: S.xs }}>
          <span style={{ width: 12, height: 2, background: C.accent, display: 'inline-block', borderTop: `1px dashed ${C.accent}` }} />
          Target
        </span>
      </div>
    </div>
  );
}

function MetricItem({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: S.xxs, fontFamily: F.family }}>
        {label}
      </div>
      <div style={{
        fontSize: F.sizeBase, fontWeight: 700,
        color: highlight || C.textPrimary,
        fontFamily: F.mono,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, fontFamily: F.family }}>
          {sub}
        </div>
      )}
    </div>
  );
}
