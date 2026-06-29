'use client';

import { colors as C } from '@/src/utils/webTheme';

interface StockRowData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  signal?: 'BUY' | 'HOLD' | 'SELL';
  score?: number;
}

interface StockRowProps {
  data: StockRowData;
  onClick?: () => void;
  compact?: boolean;
}

function toFixed(n: number | null | undefined, digits: number): string {
  if (n == null || isNaN(n)) return '0.00';
  return n.toFixed(digits);
}

export default function StockRow({ data, onClick, compact }: StockRowProps) {
  const changeColor = data.change != null && data.change >= 0 ? C.positive : C.negative;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '8px 12px' : '12px 16px',
        background: C.bgCard,
        borderRadius: '8px',
        border: '1px solid ' + C.borderLight,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgCardHover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.bgCard; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div>
          <div style={{ color: C.textPrimary, fontWeight: '700', fontSize: compact ? '14px' : '16px' }}>
            {data.symbol}
          </div>
          {!compact && (
            <div style={{ color: C.textMuted, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
              {data.name || ''}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.textPrimary, fontWeight: '600', fontSize: compact ? '14px' : '16px' }}>
            ${toFixed(data.price, 2)}
          </div>
          <div style={{ color: changeColor, fontSize: compact ? '11px' : '13px' }}>
            {(data.change != null && data.change >= 0 ? '+' : '')}{toFixed(data.change, 2)} ({(data.changePercent != null && data.changePercent >= 0 ? '+' : '')}{toFixed(data.changePercent, 2)}%)
          </div>
        </div>

        {data.signal && (
          <SignalBadge signal={data.signal} score={data.score} compact={compact} />
        )}
      </div>
    </div>
  );
}

const signalBadgeStyles = {
  BUY: { bg: C.positiveBg, text: C.positive },
  HOLD: { bg: C.warningBg, text: C.warning },
  SELL: { bg: C.negativeBg, text: C.negative },
};

function SignalBadge({ signal, score, compact }: { signal: 'BUY' | 'HOLD' | 'SELL'; score?: number; compact?: boolean }) {
  const s = signalBadgeStyles[signal] || { bg: C.bg, text: C.textMuted };

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.text}40`,
        borderRadius: '6px',
        padding: compact ? '2px 8px' : '4px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ color: s.text, fontWeight: '700', fontSize: compact ? '10px' : '12px', letterSpacing: '0.5px' }}>
        {signal === 'BUY' ? 'COMPRAR' : signal === 'SELL' ? 'VENDER' : 'MANTENER'}
      </div>
      {score != null && (
        <div style={{ color: s.text, fontSize: compact ? '12px' : '14px', fontWeight: '800' }}>
          {score}
        </div>
      )}
    </div>
  );
}
