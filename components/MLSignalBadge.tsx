'use client';

import { colors as C } from '@/src/utils/webTheme';
import type { MLResult } from '@/src/services/mlClassifier';

interface MLSignalBadgeProps {
  mlResult: MLResult | null;
  loading: boolean;
  agreesWithRuleBased: boolean | null;
}

const signalConfig: Record<string, { text: string; color: string; bg: string }> = {
  BUY: { text: 'COMPRAR', color: C.positive, bg: '#0a2e1a' },
  HOLD: { text: 'MANTENER', color: C.warning, bg: '#1a1a0a' },
  SELL: { text: 'VENDER', color: C.negative, bg: '#2e0a0a' },
};

export default function MLSignalBadge({ mlResult, loading, agreesWithRuleBased }: MLSignalBadgeProps) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 16px', borderRadius: '10px',
        background: C.bg, border: `1px solid ${C.borderLight}`,
      }}>
        <div style={{
          width: '14px', height: '14px', borderRadius: '50%',
          border: `2px solid ${C.accent}40`,
          borderTopColor: C.accent,
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: C.textMuted, fontSize: '12px', fontWeight: '600' }}>
          ML analizando...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!mlResult) return null;

  const sc = signalConfig[mlResult.signal] || signalConfig.HOLD;
  const confidencePct = Math.round(mlResult.confidence * 100);

  const agreementColor = agreesWithRuleBased === true
    ? C.positive
    : agreesWithRuleBased === false
    ? C.warning
    : C.textMuted;
  const agreementLabel = agreesWithRuleBased === true
    ? '✓ Coincide con reglas'
    : agreesWithRuleBased === false
    ? '⚠ Difiere de reglas'
    : '';

  return (
    <div style={{
      padding: '12px 16px', borderRadius: '10px',
      background: sc.bg,
      border: `1px solid ${sc.color}40`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🧠</span>
          <span style={{ color: C.textMuted, fontSize: '12px', fontWeight: '600' }}>
            Señal ML
          </span>
          <span style={{
            color: C.textMuted, fontSize: '10px',
            background: C.bgCard, padding: '1px 6px', borderRadius: '4px',
          }}>
            LiteRT.js
          </span>
        </div>
        <span style={{ color: agreementColor, fontSize: '11px', fontWeight: '600' }}>
          {agreementLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{
          color: sc.color, fontSize: '20px', fontWeight: '800',
          letterSpacing: '0.5px',
        }}>
          {sc.text}
        </span>
        <span style={{
          color: C.textMuted, fontSize: '13px', fontWeight: '600',
        }}>
          {confidencePct}% confianza
        </span>
      </div>

      {/* Probability bars */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        {mlResult.probabilities.map((prob, i) => {
          const label = ['BUY', 'HOLD', 'SELL'][i];
          const cfg = signalConfig[label];
          const isSelected = mlResult.signal === label;
          return (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{
                  color: isSelected ? cfg.color : C.textMuted,
                  fontSize: '10px', fontWeight: isSelected ? '700' : '500',
                }}>
                  {label}
                </span>
                <span style={{
                  color: isSelected ? cfg.color : C.textMuted,
                  fontSize: '10px', fontWeight: '600',
                }}>
                  {Math.round(prob * 100)}%
                </span>
              </div>
              <div style={{
                height: '3px', borderRadius: '2px',
                background: `${C.borderLight}`,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: `${Math.round(prob * 100)}%`,
                  background: isSelected ? cfg.color : `${C.textMuted}60`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
