'use client';

import { colors as C, radius as R } from '@/src/utils/webTheme';

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

const signalColors = {
  BUY: { bg: C.positiveBg, border: C.positive, text: C.positive, label: 'COMPRAR' },
  HOLD: { bg: C.warningBg, border: C.warning, text: C.warning, label: 'MANTENER' },
  SELL: { bg: C.negativeBg, border: C.negative, text: C.negative, label: 'VENDER' },
};

function toFixed(n: number | null | undefined, digits: number): string {
  if (n == null || isNaN(n)) return '0.00';
  return n.toFixed(digits);
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(2);
}

interface SignalCardProps {
  data: SignalData;
  onClick?: () => void;
  selected?: boolean;
}

const fallbackSignal = { bg: C.bg, border: C.border, text: C.textMuted, label: '—' };

function getSignalStyle(signal: string | null | undefined) {
  return signalColors[signal as keyof typeof signalColors] || fallbackSignal;
}

export default function SignalCard({ data, onClick, selected }: SignalCardProps) {
  const c = getSignalStyle(data.signal);
  const changeColor = data.change != null && data.change >= 0 ? C.positive : C.negative;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? C.bgCardHover : C.bgCard,
        borderRadius: '12px',
        padding: '16px',
        border: selected ? '1px solid ' + C.accent : '1px solid ' + C.borderLight,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ color: C.textPrimary, fontWeight: '700', fontSize: '16px' }}>{data.symbol}</span>
            {data.details.sector && (
              <span style={{ color: C.textMuted, fontSize: '11px', background: C.bg, padding: '2px 6px', borderRadius: '4px' }}>
                {data.details.sector}
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: C.textMuted, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </p>
        </div>
        <div
          style={{
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: '8px',
            padding: '6px 12px',
            textAlign: 'center',
            minWidth: '80px',
          }}
        >
          <div style={{ color: c.text, fontWeight: '700', fontSize: '15px', letterSpacing: '0.5px' }}>
            {c.label}
          </div>
          <div style={{ color: c.text, fontSize: '22px', fontWeight: '800', marginTop: '2px' }}>
            {data.score}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: C.textPrimary, fontWeight: '600', fontSize: '18px' }}>
            ${toFixed(data.price, 2)}
          </span>
          <span style={{ color: changeColor, fontSize: '13px', marginLeft: '8px' }}>
            {(data.change != null && data.change >= 0 ? '+' : '')}{toFixed(data.change, 2)} ({(data.changePercent != null && data.changePercent >= 0 ? '+' : '')}{toFixed(data.changePercent, 2)}%)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {data.conviction && (
            <TooltipBadge
              label={data.conviction === 'HIGH' ? '🔥 Alta' : data.conviction === 'MEDIUM' ? '⚡ Media' : '💭 Baja'}
              color={data.conviction === 'HIGH' ? C.positive : data.conviction === 'MEDIUM' ? C.warning : C.textMuted}
              tooltip={`Convicción: ${data.conviction}`}
            />
          )}
          {data.riskLevel && (
            <TooltipBadge
              label={data.riskLevel === 'HIGH' ? '⚠ Alto' : data.riskLevel === 'MEDIUM' ? '◆ Medio' : '● Bajo'}
              color={data.riskLevel === 'HIGH' ? C.negative : data.riskLevel === 'MEDIUM' ? C.warning : C.positive}
              tooltip={`Riesgo: ${data.riskLevel}`}
            />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: C.textMuted, borderTop: '1px solid ' + C.borderLight, paddingTop: '8px' }}>
        {data.details && data.details.peRatio > 0 && <span>PE: {toFixed(data.details.peRatio, 1)}</span>}
        {data.details && data.details.marketCap > 0 && <span>MktCap: {fmtCompact(data.details.marketCap)}</span>}
        {data.details?.trend && <span>Trend: {data.details.trend}</span>}
        {data.details?.rsi != null && <span>RSI: {toFixed(data.details.rsi, 0)}</span>}
      </div>
    </div>
  );
}

function TooltipBadge({ label, color, tooltip }: { label: string; color: string; tooltip: string }) {
  return (
    <span
      title={tooltip}
      style={{
        color,
        fontSize: '11px',
        fontWeight: '600',
        background: `${color}15`,
        padding: '2px 8px',
        borderRadius: '12px',
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  );
}
