'use client';

import { useState, useEffect } from 'react';
import ScreenerCard from './ScreenerCard';
import ScreenerDetailView from './ScreenerDetailView';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

interface RankingRow {
  symbol: string;
  scores: Record<string, number>;
  total: number;
}

interface ScreenerData {
  id: string;
  name: string;
  icon: string;
  description: string;
  updatedAt: string;
  formulas: string[];
  rankings: RankingRow[];
}

interface RankingsResponse {
  lastUpdated: string;
  screeners: ScreenerData[];
}

const SCREENER_IDS = [
  'small-mid-rotation',
  'momentum',
  'swing',
  'breakout',
  'dark-pool',
  'gamma-squeeze',
  'bull-trades',
];

export default function ScreenerRankingsPanel({
  onStockClick,
}: {
  onStockClick?: (symbol: string) => void;
}) {
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(3);
  const [selectedScreener, setSelectedScreener] = useState<ScreenerData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/screener/rankings')
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (error) {
    return (
      <div style={{
        background: C.bgCard,
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ color: C.negative, fontSize: F.sizeBase, fontFamily: 'Inter, system-ui, sans-serif' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data || data.screeners.length === 0) {
    return (
      <div style={{
        background: C.bgCard,
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ color: C.textMuted, fontSize: F.sizeBase, fontFamily: 'Inter, system-ui, sans-serif' }}>
          No screener data available
        </div>
      </div>
    );
  }

  const sortedScreeners = SCREENER_IDS
    .map(id => data.screeners.find(s => s.id === id))
    .filter(Boolean) as ScreenerData[];

  const showMore = sortedScreeners.length > visible;

  if (selectedScreener) {
    return (
      <ScreenerDetailView
        screener={selectedScreener}
        onBack={() => setSelectedScreener(null)}
        onViewStock={(symbol) => {
          if (onStockClick) onStockClick(symbol);
        }}
      />
    );
  }

  return (
    <div style={{
      background: C.bg,
      borderRadius: '24px',
      padding: '32px',
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '28px',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            color: C.textPrimary,
            fontSize: F.sizeHero,
            fontWeight: 700,
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.02em',
          }}>
            Screener
          </h2>
          <p style={{
            margin: '4px 0 0',
            color: C.textMuted,
            fontSize: F.sizeMd,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {data.lastUpdated ? `Last updated: ${data.lastUpdated}` : ''}
          </p>
        </div>
        {showMore && (
          <button
            onClick={() => setVisible(prev => Math.min(prev + 3, sortedScreeners.length))}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: R.md,
              padding: `${S.sm} ${S.lg}`,
              color: C.accent,
              fontSize: F.sizeMd,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: `background ${T.fast}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bgElevated)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Show more
          </button>
        )}
      </div>

      {/* Cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: S.xxl,
      }}>
        {sortedScreeners.slice(0, visible).map((s, i) => (
          <div key={s.id} style={{ animation: `fadeIn 400ms ${i * 80}ms ease-out both` }}>
            <ScreenerCard
              icon={s.icon}
              name={s.name}
              description={s.description}
              updatedAt={s.updatedAt}
              formulas={s.formulas}
              rankings={s.rankings}
              onExpand={() => setSelectedScreener(s)}
            />
          </div>
        ))}
      </div>

      {showMore && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => setVisible(sortedScreeners.length)}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: R.md,
              padding: `${S.md} ${S.xxl}`,
              color: C.textMuted,
              fontSize: F.sizeMd,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: `background ${T.fast}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bgElevated)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            View all {sortedScreeners.length} screeners
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{
      background: C.bg,
      borderRadius: '24px',
      padding: S.xxl,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          width: '140px',
          height: '28px',
          background: C.bgCard,
          borderRadius: R.sm,
          marginBottom: S.sm,
        }} />
        <div style={{
          width: '200px',
          height: '14px',
          background: C.bgCard,
          borderRadius: R.sm,
        }} />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: S.xxl,
      }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: C.bgCard,
            borderRadius: '20px',
            padding: '28px',
            height: '320px',
          }}>
            <div style={{ display: 'flex', gap: S.lg, marginBottom: S.xxl }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: R.full,
                background: C.bgElevated,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  width: '100px',
                  height: '12px',
                  background: C.bgElevated,
                  borderRadius: R.sm,
                  marginBottom: S.sm,
                }} />
                <div style={{
                  width: '180px',
                  height: '18px',
                  background: C.bgElevated,
                  borderRadius: R.sm,
                  marginBottom: S.sm,
                }} />
                <div style={{
                  width: '280px',
                  height: '12px',
                  background: C.bgElevated,
                  borderRadius: R.sm,
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
