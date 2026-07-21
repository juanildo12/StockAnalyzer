'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import LineChart from './LineChart';

interface MetricData {
  symbol: string;
  dates: string[];
  price: number[];
  upsideBreakout: number[];
  downsideBreakout: number[];
  volumePressure: number[];
  trendQuality: number[];
  entryConfidence: number[];
  riskReward: number[];
}

interface MetricChartPanelProps {
  symbol: string;
}

interface CardConfig {
  key: keyof Omit<MetricData, 'symbol' | 'dates' | 'price'>;
  title: string;
  description: string;
  leftLabels: number[];
  rightLabels: number[];
  color?: string;
}

const CARDS: CardConfig[] = [
  {
    key: 'upsideBreakout',
    title: 'Upside Breakout',
    description: 'Qué tan cerca está el precio del techo del rango de 20 días. Sobre 50 indica presión alcista. Volumen alto suma puntaje.',
    leftLabels: [0, 25, 50, 75, 100],
    rightLabels: [],
    color: C.positive,
  },
  {
    key: 'downsideBreakout',
    title: 'Downside Breakout',
    description: 'Qué tan cerca está el precio del suelo del rango de 20 días. Sobre 50 indica presión bajista. Volumen alto suma puntaje.',
    leftLabels: [0, 25, 50, 75, 100],
    rightLabels: [],
    color: C.negative,
  },
  {
    key: 'volumePressure',
    title: 'Volume Pressure',
    description: 'Current volume relative to the 20-day average volume. Values above 1 indicate elevated activity.',
    leftLabels: [0, 25, 50, 75, 100],
    rightLabels: [],
    color: '#60a5fa',
  },
  {
    key: 'trendQuality',
    title: 'Trend Quality',
    description: 'Score based on price position relative to moving averages and short-term momentum.',
    leftLabels: [0, 25, 50, 75, 100],
    rightLabels: [],
    color: '#a78bfa',
  },
  {
    key: 'entryConfidence',
    title: 'Entry Confidence',
    description: 'Combined score using RSI, proximity to support, and volume confirmation.',
    leftLabels: [0, 25, 50, 75, 100],
    rightLabels: [],
    color: '#f59e0b',
  },
  {
    key: 'riskReward',
    title: 'Risk / Reward Evolution',
    description: 'Estimated distance to 20-day resistance divided by distance to 20-day support.',
    leftLabels: [0, 25, 50, 75, 100],
    rightLabels: [],
    color: '#f472b6',
  },
];

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MetricChartCard({ title, description, metricData, cardKey, dates, price, color }: {
  title: string;
  description: string;
  metricData: number[];
  cardKey: string;
  dates: string[];
  price: number[];
  color?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Compute price axis labels (min/max)
  const priceMin = price.length > 0 ? Math.min(...price) : 0;
  const priceMax = price.length > 0 ? Math.max(...price) : 1;
  const priceRange = priceMax - priceMin || 1;
  const priceStep = priceRange / 4;
  const rightLabels = [0, 1, 2, 3, 4].map(i => Math.round((priceMin + i * priceStep) * 100) / 100);

  return (
    <div style={{
      background: C.bgCard,
      borderRadius: R.xl,
      padding: S.xl,
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.md }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
            <h3 style={{
              margin: 0, color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '700',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {title}
            </h3>
            <div
              style={{
                width: '18px', height: '18px', borderRadius: R.full,
                background: C.border, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'help', position: 'relative',
                fontSize: F.sizeXs, color: C.textMuted, fontWeight: '600',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              ?
              {showTooltip && (
                <div style={{
                  position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)',
                  background: C.bg, color: C.textPrimary, fontSize: F.sizeXs, padding: `${S.sm} ${S.md}`,
                  borderRadius: R.md, width: '220px', textAlign: 'center', zIndex: 10,
                  fontWeight: '400', lineHeight: '1.4', fontFamily: 'Inter, system-ui, sans-serif',
                  pointerEvents: 'none',
                }}>
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: S.lg, marginBottom: S.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: R.full, background: color || C.accent, display: 'inline-block' }} />
          <span style={{ color: C.textMuted, fontSize: F.sizeXs, fontFamily: 'Inter, system-ui, sans-serif' }}>Indicator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: R.full, background: C.accentLight, display: 'inline-block' }} />
          <span style={{ color: C.textMuted, fontSize: F.sizeXs, fontFamily: 'Inter, system-ui, sans-serif' }}>Price</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%' }}>
        <LineChart
          data={metricData}
          data2={price}
          height={200}
          color={color || C.accent}
          color2={C.accentLight}
          leftLabels={[0, 25, 50, 75, 100]}
          rightLabels={rightLabels}
          dateStart={dates[0]}
          dateEnd={dates[dates.length - 1]}
          animated
        />
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div style={{
      background: C.bgCard, borderRadius: R.xl, padding: S.xxl,
      border: `1px solid ${C.border}`, height: '280px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: C.textMuted, fontSize: F.sizeMd, fontFamily: 'Inter, system-ui, sans-serif' }}>
        Loading...
      </div>
    </div>
  );
}

export default function MetricChartPanel({ symbol }: MetricChartPanelProps) {
  const [data, setData] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/historical-metrics?symbol=${symbol}`);
      setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: S.md }}>
        {[1, 2, 3, 4, 5, 6].map(i => <LoadingCard key={i} />)}
      </div>
    );
  }

  if (!data || !data.dates || data.dates.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: S.md }}>
      {CARDS.map(card => (
        <MetricChartCard
          key={card.key}
          title={card.title}
          description={card.description}
          cardKey={card.key}
          metricData={data[card.key] as number[]}
          dates={data.dates}
          price={data.price}
          color={card.color}
        />
      ))}
    </div>
  );
}
