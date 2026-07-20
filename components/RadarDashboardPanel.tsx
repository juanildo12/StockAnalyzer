'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface RadarMetricSet {
  trendQuality: number;
  emaAlignment: number;
  adrPotential: number;
  relativeStrength: number;
  marketContext: number;
}

interface ShortTermMetricSet {
  breakoutStrength: number;
  volumeSpike: number;
  candleQuality: number;
  entryConfidence: number;
  riskReward: number;
}

interface RadarData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  updated: string;
  longTerm: RadarMetricSet;
  shortTerm: ShortTermMetricSet;
}

interface RadarDashboardPanelProps {
  symbol: string;
}

const LT_LABELS: { key: keyof RadarMetricSet; label: string }[] = [
  { key: 'trendQuality', label: 'Trend Quality' },
  { key: 'emaAlignment', label: 'EMA Alignment' },
  { key: 'adrPotential', label: 'ADR Potential' },
  { key: 'relativeStrength', label: 'Relative Strength' },
  { key: 'marketContext', label: 'Market Context' },
];

const ST_LABELS: { key: keyof ShortTermMetricSet; label: string }[] = [
  { key: 'breakoutStrength', label: 'Breakout Strength' },
  { key: 'volumeSpike', label: 'Volume Spike' },
  { key: 'candleQuality', label: 'Candle Quality' },
  { key: 'entryConfidence', label: 'Entry Confidence' },
  { key: 'riskReward', label: 'Risk/Reward' },
];

function MetricBar({ label, value, color = C.accent }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
      <span style={{
        color: C.textMuted, fontSize: F.sizeSm, fontWeight: '500', minWidth: '120px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: '4px', background: C.border, borderRadius: R.sm, overflow: 'hidden',
      }}>
        <div style={{
          width: `${value}%`, height: '100%', background: color, borderRadius: R.sm,
          transition: 'width 400ms cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </div>
      <span style={{
        color: C.textPrimary, fontSize: F.sizeMd, fontWeight: '700', minWidth: '28px', textAlign: 'right',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {value}
      </span>
    </div>
  );
}

function RadarColumn({
  title,
  icon,
  metrics,
  labels,
  color,
}: {
  title: string;
  icon: string;
  metrics: Record<string, number>;
  labels: { key: string; label: string }[];
  color?: string;
}) {
  return (
    <div style={{
      background: C.bgCard,
      borderRadius: R.xl,
      padding: S.lg,
      border: `1px solid ${C.border}`,
    }}>
      <h3 style={{
        margin: `0 0 ${S.xl}`, color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600',
        fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: S.sm,
      }}>
        {icon} {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {labels.map(l => (
          <MetricBar key={l.key} label={l.label} value={metrics[l.key] ?? 50} color={color || C.accent} />
        ))}
      </div>
    </div>
  );
}

export default function RadarDashboardPanel({ symbol }: RadarDashboardPanelProps) {
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRadar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/radar?symbol=${symbol}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { fetchRadar(); }, [fetchRadar]);

  if (loading) {
    return (
      <div style={{
        background: C.bgCard, borderRadius: R.xl, border: `1px solid ${C.border}`, padding: '48px',
        textAlign: 'center',
      }}>
        <div style={{ color: C.textMuted, fontSize: F.sizeBase, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Loading radar data...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const changeStr = data.change >= 0 ? `+${data.change.toFixed(2)}` : data.change.toFixed(2);
  const changePctStr = data.changePercent >= 0 ? `+${data.changePercent.toFixed(2)}%` : `${data.changePercent.toFixed(2)}%`;
  const changeColor = data.change >= 0 ? C.positive : C.negative;
  const updated = new Date(data.updated);

  return (
    <div style={{
      background: C.bgCard,
      borderRadius: R.xl,
      padding: S.xl,
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: S.xxl,
      }}>
        <div>
          <h2 style={{
            margin: 0, color: C.textPrimary, fontSize: F.sizeHero, fontWeight: '700',
            fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em',
          }}>
            {data.symbol}
          </h2>
          <p style={{
            margin: `${S.xs} 0 0`, color: C.textMuted, fontSize: F.sizeSm, fontWeight: '500',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Last updated: {updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {updated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            color: C.textPrimary, fontSize: F.sizeHero, fontWeight: '700',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            ${data.price.toFixed(2)}
          </div>
          <div style={{
            color: changeColor, fontSize: F.sizeBase, fontWeight: '600',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {changeStr} ({changePctStr})
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: S.xxl,
      }}>
        <RadarColumn
          title="Long-Term Analysis"
          icon="📈"
          metrics={data.longTerm as unknown as Record<string, number>}
          labels={LT_LABELS as any}
          color={C.accent}
        />
        <RadarColumn
          title="Short-Term Analysis"
          icon="⚡"
          metrics={data.shortTerm as unknown as Record<string, number>}
          labels={ST_LABELS as any}
          color={C.accent}
        />
      </div>
    </div>
  );
}
