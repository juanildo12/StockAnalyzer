'use client';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

interface SignalData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  signal: 'BUY' | 'HOLD' | 'SELL';
  score: number;
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  details: {
    peRatio: number;
    marketCap: number;
    sector?: string;
    trend?: string;
    rsi?: number;
  };
}

function classifyShortTerm(s: SignalData) {
  const trend = s.details?.trend;
  const rsi = s.details?.rsi;
  const score = s.score;

  // Bullish short-term: upward trend + not overbought, or score improving
  if (trend === 'alcista' && (rsi == null || rsi < 65) && score >= 50) {
    return { type: 'bull', label: 'Short-Term Bull', icon: '🚀', desc: 'Impulso alcista a corto plazo', color: C.positive };
  }
  // Bearish short-term: downward trend, or oversold + weak score
  if (trend === 'bajista' && score < 55) {
    return { type: 'bear', label: 'Short-Term Bear', icon: '🔻', desc: 'Presión bajista a corto plazo', color: C.negative };
  }
  // If RSI is very oversold and score is decent, could be a bounce candidate
  if (rsi != null && rsi < 30 && score >= 50) {
    return { type: 'bull', label: 'Short-Term Bull', icon: '🚀', desc: 'Potencial rebote (sobreventa)', color: C.accent };
  }
  return null;
}

function classifyLongTerm(s: SignalData) {
  const score = s.score;

  if (score >= 58) {
    return { type: 'bull', label: 'Long-Term Bull', icon: '🐂', desc: 'Fundamentos sólidos a largo plazo', color: C.positive };
  }
  if (score <= 42) {
    return { type: 'bear', label: 'Long-Term Bear', icon: '🐻', desc: 'Debilidad fundamental prolongada', color: C.negative };
  }
  return null;
}

interface BullsBearsSectionProps {
  signals: SignalData[];
  onStockClick: (symbol: string) => void;
}

export default function BullsBearsSection({ signals, onStockClick }: BullsBearsSectionProps) {
  const shortTermBulls = signals.map(s => ({ s, c: classifyShortTerm(s) })).filter(x => x.c?.type === 'bull').slice(0, 4);
  const shortTermBears = signals.map(s => ({ s, c: classifyShortTerm(s) })).filter(x => x.c?.type === 'bear').slice(0, 4);
  const longTermBulls = signals.map(s => ({ s, c: classifyLongTerm(s) })).filter(x => x.c?.type === 'bull').slice(0, 4);
  const longTermBears = signals.map(s => ({ s, c: classifyLongTerm(s) })).filter(x => x.c?.type === 'bear').slice(0, 4);

  const hasAny = shortTermBulls.length + shortTermBears.length + longTermBulls.length + longTermBears.length > 0;
  if (!hasAny) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '18px', fontWeight: '700' }}>🐂🐻 Bulls & Bears</h2>
        <span style={{ color: C.textMuted, fontSize: '13px' }}>Clasificación por horizonte temporal</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Short-term column */}
        <div>
          <h3 style={{ margin: '0 0 8px', color: C.textMuted, fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>
            CORTO PLAZO
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {shortTermBulls.map(({ s, c }) => (
              <MiniCard key={s.symbol} data={s} c={c!} onClick={() => onStockClick(s.symbol)} />
            ))}
            {shortTermBears.map(({ s, c }) => (
              <MiniCard key={s.symbol} data={s} c={c!} onClick={() => onStockClick(s.symbol)} />
            ))}
            {shortTermBulls.length === 0 && shortTermBears.length === 0 && (
              <div style={{ color: C.textMuted, fontSize: '13px', padding: '12px', background: C.bg, borderRadius: '8px', textAlign: 'center' }}>
                Sin señales claras a corto plazo
              </div>
            )}
          </div>
        </div>

        {/* Long-term column */}
        <div>
          <h3 style={{ margin: '0 0 8px', color: C.textMuted, fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>
            LARGO PLAZO
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {longTermBulls.map(({ s, c }) => (
              <MiniCard key={s.symbol} data={s} c={c!} onClick={() => onStockClick(s.symbol)} />
            ))}
            {longTermBears.map(({ s, c }) => (
              <MiniCard key={s.symbol} data={s} c={c!} onClick={() => onStockClick(s.symbol)} />
            ))}
            {longTermBulls.length === 0 && longTermBears.length === 0 && (
              <div style={{ color: C.textMuted, fontSize: '13px', padding: '12px', background: C.bg, borderRadius: '8px', textAlign: 'center' }}>
                Sin señales claras a largo plazo
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ data, c, onClick }: { data: SignalData; c: { icon: string; label: string; desc: string; color: string }; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: C.bgCard,
        borderRadius: '8px',
        border: '1px solid ' + C.borderLight,
        borderLeft: `3px solid ${c.color}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgCardHover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.bgCard; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <span style={{ fontSize: '18px' }}>{c.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: C.textPrimary, fontWeight: '700', fontSize: '14px' }}>{data.symbol}</span>
            <span style={{ color: c.color, fontSize: '11px', fontWeight: '600' }}>{c.label}</span>
          </div>
          <div style={{ color: C.textMuted, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.desc}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ color: C.textPrimary, fontWeight: '600', fontSize: '13px' }}>
          ${data.price != null ? data.price.toFixed(2) : '0.00'}
        </div>
        <div style={{ color: data.change != null && data.change >= 0 ? C.positive : C.negative, fontSize: '11px' }}>
          {data.changePercent != null ? `${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%` : '—'}
        </div>
      </div>
    </div>
  );
}
