'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R } from '@/src/utils/webTheme';

interface SqueezeResult {
  score: number;
  daysToCover: number;
  shortPctFloat: number;
  floatValue: number;
  volumeSurge: number;
  signal: 'extreme' | 'high' | 'moderate' | 'low';
  reasons: string[];
}

interface SqueezeResponse {
  symbol: string;
  price: number;
  asOf: number;
  shortInterest: { shares: number; settlementDate: string } | null;
  float: { shares: number; percent: number; effectiveDate: string } | null;
  squeeze: SqueezeResult | null;
  source: 'massive' | 'unavailable';
  note?: string;
}

interface SqueezeRadarPanelProps {
  symbol: string;
  onClose?: () => void;
}

const SIGNAL_META: Record<SqueezeResult['signal'], { label: string; color: (c: typeof C) => string; bg: (c: typeof C) => string }> = {
  extreme: { label: '🔥 Squeeze extremo', color: (c) => c.negative, bg: (c) => c.negativeBg },
  high: { label: '⚠️ Squeeze alto', color: (c) => c.warning, bg: (c) => c.warningBg },
  moderate: { label: '🟡 Squeeze moderado', color: (c) => c.info, bg: (c) => c.infoBg },
  low: { label: '⚪ Squeeze bajo', color: (c) => c.textSecondary, bg: (c) => c.textMuted + '22' },
};

function fmtShares(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function fmtMoney(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(n);
}

export default function SqueezeRadarPanel({ symbol, onClose }: SqueezeRadarPanelProps) {
  const [data, setData] = useState<SqueezeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/squeeze?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (json && !json.error) setData(json);
      else setError(json?.error || 'Sin datos');
    } catch {
      setError('Error cargando Squeeze Radar');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '32px', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, fontSize: '14px' }}>Calculando presión de cortos...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '24px', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, fontSize: '13px' }}>{error || 'Sin datos'}</div>
        <button onClick={fetchData} style={{ marginTop: '12px', background: C.accent, color: 'white', border: 'none', borderRadius: R.sm, padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const sq = data.squeeze;
  const meta = sq ? SIGNAL_META[sq.signal] : null;

  return (
    <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: C.textPrimary, fontSize: '16px', fontWeight: '700' }}>🩳 Squeeze Radar</h3>
            <p style={{ margin: 0, color: C.textMuted, fontSize: '12px' }}>
              Potencial de compresión de cortos para {data.symbol}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
          )}
        </div>

        {sq && meta ? (
          <div style={{
            marginTop: '16px', padding: '16px', borderRadius: R.lg,
            background: `linear-gradient(135deg, ${meta.bg(C)}44, ${C.bg})`,
            border: `1px solid ${meta.color(C)}44`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>SQUEEZE SCORE</div>
                <div style={{ color: meta.color(C), fontSize: '32px', fontWeight: '800', lineHeight: 1 }}>
                  {sq.score}<span style={{ fontSize: '16px', fontWeight: '500' }}>/100</span>
                </div>
              </div>
              <div style={{
                fontSize: '13px', fontWeight: '600', padding: '6px 16px', borderRadius: R.full,
                background: meta.bg(C), color: meta.color(C), border: `1px solid ${meta.color(C)}44`,
              }}>
                {meta.label}
              </div>
            </div>
            <div style={{ marginTop: '12px', height: '4px', background: C.bg, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${sq.score}%`, height: '100%', background: meta.color(C), borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '16px', padding: '16px', borderRadius: R.lg, background: C.bgElevated, border: '1px solid ' + C.border }}>
            <div style={{ color: C.textMuted, fontSize: '13px' }}>
              {data.note || 'Sin datos suficientes de interés corto para puntuar.'}
            </div>
          </div>
        )}
      </div>

      {/* Métricas */}
      {sq && (
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Metric label="Días a cubrir" value={sq.daysToCover.toFixed(1)} hint="short ÷ ADV" />
          <Metric label="% del float en corto" value={sq.shortPctFloat.toFixed(1) + '%'} hint="short ÷ free float" />
          <Metric label="Free float" value={data.float ? fmtShares(data.float.shares) : '—'} hint={data.float ? fmtMoney(data.float.shares * data.price) : 'sin dato'} />
          <Metric label="Surgencia de volumen" value={sq.volumeSurge > 0 ? sq.volumeSurge.toFixed(2) + '×' : '—'} hint="vol. última sesión ÷ ADV" />
        </div>
      )}

      {/* Razones */}
      {sq && sq.reasons.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sq.reasons.map((r, i) => (
              <span key={i} style={{
                fontSize: '11px', fontWeight: '500', padding: '4px 10px', borderRadius: R.full,
                background: C.bgElevated, color: C.textSecondary, border: '1px solid ' + C.borderLight,
              }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid ' + C.borderLight, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.textMuted, fontSize: '11px' }}>
          {data.shortInterest?.settlementDate ? `Interés corto FINRA: ${data.shortInterest.settlementDate}` : 'Interés corto: n/d'}
        </span>
        <span style={{ color: C.textMuted, fontSize: '11px' }}>
          {data.source === 'massive' ? 'Massive · ' : ''}{new Date(data.asOf).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: R.md, background: C.bgElevated, border: '1px solid ' + C.borderLight }}>
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: C.textPrimary, fontSize: '20px', fontWeight: '800', lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ color: C.textMuted, fontSize: '10px', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}
