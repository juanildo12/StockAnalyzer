'use client';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

import { useState } from 'react';
import type { NNWCResult } from '@/src/types';

interface NNWCCardProps {
  result: NNWCResult | null;
  symbol?: string;
  cash?: number;
  receivables?: number;
  inventory?: number;
  totalLiabilities?: number;
  marketCap?: number;
}

function formatCurrency(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-$' : '$';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString()}`;
}

function formatNumber(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-$' : '$';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString()}`;
}

function getClassificationConfig(classification: string) {
  switch (classification) {
    case 'excelente':
      return {
        label: 'Excelente Oportunidad Net-Net',
        color: C.positive,
        bg: `${C.positive}20`,
        icon: '🟢',
      };
    case 'cumple':
      return {
        label: 'Cumple criterio Net-Net',
        color: C.accent,
        bg: `${C.accent}20`,
        icon: '🔵',
      };
    case 'no-cumple':
      return {
        label: 'No cumple criterio Net-Net',
        color: C.negative,
        bg: `${C.negative}20`,
        icon: '🔴',
      };
    case 'negativo':
      return {
        label: 'NNWC Negativo',
        color: C.warning,
        bg: `${C.warning}20`,
        icon: '⚠️',
      };
    default:
      return {
        label: 'Sin datos disponibles',
        color: C.textMuted,
        bg: `${C.textMuted}20`,
        icon: '⚪',
      };
  }
}

export default function NNWCCard({ result, symbol, cash, receivables, inventory, totalLiabilities, marketCap }: NNWCCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  if (!result) {
    return (
      <div style={{ background: C.bgCard, borderRadius: '12px', padding: '24px', border: '1px solid ' + C.border }}>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🧠</p>
          <p style={{ fontSize: '16px', margin: '0 0 8px' }}>No hay datos disponibles</p>
          <p style={{ fontSize: '13px', margin: 0 }}>
            Analiza una acción para ver su análisis Net-Net
          </p>
        </div>
      </div>
    );
  }

  const nnwc = result.nnwc;
  const discount = result.discountPercent;
  const ratio = result.ratio;
  const classification = result.classification;
  const config = getClassificationConfig(classification);

  const barPercent = nnwc > 0 ? Math.min(Math.max((result.ratio * 100), 0), 100) : 0;

  return (
    <div style={{ background: C.bgCard, borderRadius: '12px', padding: '24px', border: '1px solid ' + C.border, maxWidth: '600px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0', color: C.textPrimary, fontSize: '18px', fontWeight: '600' }}>
          🧠 Análisis Net-Net (Benjamin Graham)
        </h3>
        {symbol && (
          <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: '13px' }}>
            {symbol}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: C.bg, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>NNWC</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: classification === 'excelente' ? C.positive : classification === 'cumple' ? C.accent : C.textPrimary }}>
            {formatNumber(nnwc)}
          </p>
        </div>
        <div style={{ background: C.bg, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Market Cap</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: C.textPrimary }}>
            {marketCap ? formatNumber(marketCap) : formatNumber(result.ratio > 0 ? nnwc * result.ratio : 0)}
          </p>
        </div>
        <div style={{ background: C.bg, borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Descuento</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: discount > 0 ? C.positive : C.negative }}>
            {discount > 0 ? `${discount}%` : '0%'}
          </p>
        </div>
      </div>

      <div style={{
        background: config.bg,
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '16px',
        textAlign: 'center',
        border: `1px solid ${config.color}40`,
      }}>
        <span style={{ fontSize: '16px', fontWeight: '600', color: config.color }}>
          {config.icon} {config.label}
        </span>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', color: C.textMuted }}>Market Cap</span>
          <span style={{ fontSize: '12px', color: C.textMuted }}>NNWC</span>
        </div>
        <div style={{ position: 'relative', height: '24px', background: C.bg, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${barPercent}%`,
            background: barPercent < 67 ? C.positive : barPercent < 100 ? C.accent : C.negative,
            borderRadius: '12px',
            transition: 'width 0.5s ease',
          }} />
          <div style={{
            position: 'absolute',
            left: '66.7%',
            top: 0,
            height: '100%',
            width: '2px',
            background: 'rgba(255,255,255,0.3)',
          }} />
          <div style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            height: '100%',
            width: '2px',
            background: 'rgba(255,255,255,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            left: `${barPercent}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: C.textPrimary,
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            border: '2px solid ' + C.bg,
            zIndex: 2,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: C.textMuted }}>0%</span>
          <span style={{ fontSize: '11px', color: C.textMuted }}>67%</span>
          <span style={{ fontSize: '11px', color: C.textMuted }}>100%</span>
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid ' + C.border,
            background: 'transparent',
            color: C.textSecondary,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>¿Cómo se calcula?</span>
          <span style={{ transform: showExplanation ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </button>
        {showExplanation && (
          <div style={{
            marginTop: '8px',
            padding: '16px',
            background: C.bg,
            borderRadius: '8px',
            fontSize: '13px',
            color: C.textMuted,
            lineHeight: '1.6',
          }}>
            <p style={{ margin: '0 0 12px', fontFamily: 'monospace', color: C.textSecondary, fontSize: '12px' }}>
              NNWC = Cash + Receivables + (50% × Inventory) − Total Liabilities
            </p>
            {cash !== undefined && receivables !== undefined && inventory !== undefined && totalLiabilities !== undefined && (
              <div style={{ margin: '0 0 12px', padding: '12px', background: C.bgCard, borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: C.textSecondary, lineHeight: '1.8' }}>
                <div>Cash:                {formatCurrency(cash)}</div>
                <div>Receivables:         {formatCurrency(receivables)}</div>
                <div>Inventory × 50%:     {formatCurrency(inventory)} × 0.5 = {formatCurrency(Math.round(inventory * 0.5))}</div>
                <div>Total Liabilities:   −{formatCurrency(totalLiabilities)}</div>
                <div style={{ borderTop: '1px solid ' + C.border, margin: '4px 0', paddingTop: '4px', color: C.textPrimary, fontWeight: '600' }}>
                  NNWC = {formatCurrency(nnwc)}
                </div>
              </div>
            )}
            <p style={{ margin: '0 0 12px', fontSize: '12px' }}>
              Benjamin Graham utilizaba este método para estimar cuánto valdría una empresa si se liquidaran sus activos corrientes de forma conservadora y se pagaran todas sus deudas.
            </p>
            <p style={{ margin: '0 0 8px', color: C.textSecondary, fontWeight: '600' }}>Criterios de clasificación:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: C.positive, fontWeight: 'bold' }}>🟢</span>
                <span><strong style={{ color: C.positive }}>Excelente:</strong> MarketCap &lt; 67% del NNWC</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: C.accent, fontWeight: 'bold' }}>🔵</span>
                <span><strong style={{ color: C.accent }}>Cumple:</strong> MarketCap &lt; NNWC</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: C.negative, fontWeight: 'bold' }}>🔴</span>
                <span><strong style={{ color: C.negative }}>No cumple:</strong> MarketCap ≥ NNWC</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
