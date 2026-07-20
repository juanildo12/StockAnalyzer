'use client';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

import type { GrahamScoreResult } from '@/src/services/grahamAnalysis';

interface GrahamMetricsProps {
  result: GrahamScoreResult | null;
}

function getScoreColor(percent: number): string {
  if (percent >= 80) return C.positive;
  if (percent >= 50) return C.warning;
  return C.negative;
}

function getScoreLabel(percent: number): string {
  if (percent >= 80) return 'Valor Sólido';
  if (percent >= 50) return 'Potencial';
  return 'No califica';
}

const metricStyle = (passes: boolean) => ({
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  padding: '12px 0',
  borderBottom: '1px solid ' + C.border,
  opacity: passes ? 1 : 0.6,
});

const labelStyle = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: '8px',
  fontSize: F.sizeMd,
  color: C.textSecondary,
};

const valueStyle = (passes: boolean) => ({
  fontSize: F.sizeMd,
  fontWeight: '600' as const,
  color: passes ? C.positive : C.negative,
});

export default function GrahamMetrics({ result }: GrahamMetricsProps) {
  if (!result) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '24px', border: '1px solid ' + C.border, textAlign: 'center', color: C.textMuted }}>
        <p style={{ fontSize: F.sizeBase, margin: 0 }}>Analiza una acción para ver los indicadores</p>
      </div>
    );
  }

  const metrics = [result.ncav, result.netCash, result.ev, result.currentRatio, result.priceToBook];

  return (
    <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '24px', border: '1px solid ' + C.border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>
          📊 Score Graham Modernizado
        </h3>
        <div style={{
          background: `${getScoreColor(result.scorePercent)}20`,
          border: `1px solid ${getScoreColor(result.scorePercent)}40`,
          borderRadius: '20px',
          padding: '4px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '20px', fontWeight: '700', color: getScoreColor(result.scorePercent) }}>
            {result.passingCount}/{result.totalCount}
          </span>
          <span style={{ fontSize: F.sizeSm, color: getScoreColor(result.scorePercent), fontWeight: '500' }}>
            {getScoreLabel(result.scorePercent)}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        {metrics.map((m) => (
          <div key={m.name} style={metricStyle(m.passes)}>
            <div style={labelStyle}>
              <span>{m.passes ? '✅' : '❌'}</span>
              <div>
                <span style={{ color: C.textPrimary, fontWeight: '500' }}>{m.name}</span>
                <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: '2px' }}>{m.formula}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <div style={valueStyle(m.passes)}>
                {m.name === 'Current Ratio (Liquidez)' || m.name === 'P/B (Price to Book)'
                  ? m.value.toFixed(2)
                  : `$${(Math.abs(m.value) >= 1e12 ? (m.value / 1e12).toFixed(2) + 'T' :
                      Math.abs(m.value) >= 1e9 ? (m.value / 1e9).toFixed(2) + 'B' :
                      Math.abs(m.value) >= 1e6 ? (m.value / 1e6).toFixed(2) + 'M' :
                      Math.abs(m.value) >= 1e3 ? (m.value / 1e3).toFixed(1) + 'K' :
                      m.value.toLocaleString())}`}
              </div>
              <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '2px' }}>{m.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <details style={{ fontSize: F.sizeSm, color: C.textMuted }}>
        <summary style={{ cursor: 'pointer', fontWeight: '500' }}>📖 ¿Qué significan estos indicadores?</summary>
        <div style={{ marginTop: '8px', padding: '12px', background: C.bg, borderRadius: R.md, lineHeight: '1.8' }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: C.textSecondary }}>NCAV:</strong> Si el MarketCap es menor al NCAV, compras la empresa por menos de lo que valen sus activos corrientes netos — la regla clásica de Graham.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: C.textSecondary }}>Net Cash:</strong> Si el MarketCap es menor al efectivo neto, la acción se vende por menos que el efectivo que tiene — el resto del negocio lo obtienes gratis.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: C.textSecondary }}>EV Negativo:</strong> El santo grial del value investing. Significa que comprando la empresa, te pagan por quedarte con el negocio (el efectivo supera la deuda + el precio de la acción).
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: C.textSecondary }}>Current Ratio:</strong> Mide si la empresa puede pagar sus deudas de corto plazo con sus activos líquidos. &ge;1.5 es saludable.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: C.textSecondary }}>P/B:</strong> Compara el precio de la acción con su valor en libros. Graham recomendaba &lt;1.0. Hoy se considera atractivo &lt;1.2.
          </p>
        </div>
      </details>
    </div>
  );
}
