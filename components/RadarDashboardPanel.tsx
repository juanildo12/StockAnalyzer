'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R } from '@/src/utils/webTheme';

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

const ACCENT = '#C65BFF';

function MetricBar({ label, value, color = ACCENT }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{
        color: '#86868B', fontSize: '12px', fontWeight: '500', minWidth: '120px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: '4px', background: '#E8E8ED', borderRadius: '2px', overflow: 'hidden',
      }}>
        <div style={{
          width: `${value}%`, height: '100%', background: color, borderRadius: '2px',
          transition: 'width 400ms cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </div>
      <span style={{
        color: '#1D1D1F', fontSize: '13px', fontWeight: '700', minWidth: '28px', textAlign: 'right',
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
      background: '#FFFFFF',
      borderRadius: '20px',
      padding: '16px',
      border: '1px solid #E8E8ED',
    }}>
      <h3 style={{
        margin: '0 0 20px', color: '#1D1D1F', fontSize: '15px', fontWeight: '600',
        fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        {icon} {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {labels.map(l => (
          <MetricBar key={l.key} label={l.label} value={metrics[l.key] ?? 50} color={color || ACCENT} />
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
        background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E8E8ED', padding: '48px',
        textAlign: 'center',
      }}>
        <div style={{ color: '#86868B', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Loading radar data...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const changeStr = data.change >= 0 ? `+${data.change.toFixed(2)}` : data.change.toFixed(2);
  const changePctStr = data.changePercent >= 0 ? `+${data.changePercent.toFixed(2)}%` : `${data.changePercent.toFixed(2)}%`;
  const changeColor = data.change >= 0 ? '#22c55e' : '#ef4444';
  const updated = new Date(data.updated);

  return (
    <div style={{
      background: '#F5F5F7',
      borderRadius: '24px',
      padding: '20px',
      border: '1px solid #E8E8ED',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '28px',
      }}>
        <div>
          <h2 style={{
            margin: 0, color: '#1D1D1F', fontSize: '28px', fontWeight: '700',
            fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.02em',
          }}>
            {data.symbol}
          </h2>
          <p style={{
            margin: '4px 0 0', color: '#86868B', fontSize: '12px', fontWeight: '500',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Last updated: {updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {updated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            color: '#1D1D1F', fontSize: '28px', fontWeight: '700',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            ${data.price.toFixed(2)}
          </div>
          <div style={{
            color: changeColor, fontSize: '14px', fontWeight: '600',
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
        gap: '24px',
      }}>
        <RadarColumn
          title="Long-Term Analysis"
          icon="📈"
          metrics={data.longTerm as unknown as Record<string, number>}
          labels={LT_LABELS as any}
          color={ACCENT}
        />
        <RadarColumn
          title="Short-Term Analysis"
          icon="⚡"
          metrics={data.shortTerm as unknown as Record<string, number>}
          labels={ST_LABELS as any}
          color={ACCENT}
        />
      </div>
    </div>
  );
}
