'use client';

import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import type { MLResult, MLSignal } from '@/src/services/mlClassifier';

interface MLSignalBadgeProps {
  mlResult: MLResult | null;
  loading: boolean;
  ruleBasedSignal?: MLSignal | null;
}

const signalConfig: Record<string, { text: string; color: string; bg: string }> = {
  BUY: { text: 'COMPRAR', color: C.positive, bg: `${C.positive}30` },
  HOLD: { text: 'MANTENER', color: C.warning, bg: `${C.warning}30` },
  SELL: { text: 'VENDER', color: C.negative, bg: `${C.negative}30` },
};

function ProbBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  const pct = Math.round(prob * 100);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ color: C.textMuted, fontSize: '10px', fontWeight: '500' }}>{label}</span>
        <span style={{ color: C.textMuted, fontSize: '10px', fontWeight: '600' }}>{pct}%</span>
      </div>
      <div style={{ height: '3px', borderRadius: '2px', background: C.borderLight, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: color, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

function TimeframeColumn({
  title, icon, result, ruleSignal,
}: {
  title: string; icon: string;
  result: { signal: MLSignal; confidence: number; probabilities: [number, number, number] };
  ruleSignal?: MLSignal | null;
}) {
  const sc = signalConfig[result.signal] || signalConfig.HOLD;
  const pct = Math.round(result.confidence * 100);
  const agrees = ruleSignal === result.signal;

  return (
    <div style={{ flex: 1, padding: '10px 12px', borderRadius: R.md, background: sc.bg, border: `1px solid ${sc.color}30` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: C.textMuted, fontSize: F.sizeXs, fontWeight: '600' }}>{icon} {title}</span>
        {ruleSignal && (
          <span style={{
            color: agrees ? C.positive : C.warning, fontSize: '9px', fontWeight: '600',
          }}>
            {agrees ? '✓' : '≠ reglas'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <span style={{ color: sc.color, fontSize: F.sizeLg, fontWeight: '800' }}>{sc.text}</span>
        <span style={{ color: C.textMuted, fontSize: F.sizeSm, fontWeight: '600' }}>{pct}%</span>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <ProbBar label="B" prob={result.probabilities[0]} color={C.positive} />
        <ProbBar label="H" prob={result.probabilities[1]} color={C.warning} />
        <ProbBar label="S" prob={result.probabilities[2]} color={C.negative} />
      </div>
    </div>
  );
}

export default function MLSignalBadge({ mlResult, loading, ruleBasedSignal }: MLSignalBadgeProps) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 16px', borderRadius: '10px',
        background: C.bg, border: `1px solid ${C.borderLight}`,
      }}>
        <div style={{
          width: '14px', height: '14px', borderRadius: R.full,
          border: `2px solid ${C.accent}40`, borderTopColor: C.accent,
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: C.textMuted, fontSize: F.sizeSm, fontWeight: '600' }}>ML analizando...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!mlResult) return null;

  const different = mlResult.day.signal !== mlResult.swing.signal;

  return (
    <div style={{ padding: '12px 16px', borderRadius: '10px', background: C.bgCard, border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: F.sizeBase }}>🧠</span>
        <span style={{ color: C.textPrimary, fontSize: F.sizeSm, fontWeight: '700' }}>Señal ML</span>
        <span style={{ color: C.textMuted, fontSize: '10px', background: C.bg, padding: '1px 6px', borderRadius: R.sm }}>
          MLP Dual-Head
        </span>
        {different && (
          <span style={{
            color: C.accent, fontSize: '10px', fontWeight: '700',
            background: C.accentGlow, padding: '2px 8px', borderRadius: R.sm,
          }}>
            ⚡ Señales diferentes
          </span>
        )}
      </div>

      {/* Two columns: Daytrading + Swing */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <TimeframeColumn title="Daytrade" icon="⚡" result={mlResult.day} ruleSignal={ruleBasedSignal} />
        <TimeframeColumn title="Swing" icon="📈" result={mlResult.swing} ruleSignal={ruleBasedSignal} />
      </div>

      {/* Footer hint when signals differ */}
      {different && (
        <div style={{
          marginTop: '8px', padding: '6px 10px', borderRadius: R.sm,
          background: C.accentGlow, border: `1px solid ${C.accent}30`,
          color: C.textMuted, fontSize: '10px', lineHeight: '1.4',
        }}>
          <strong style={{ color: C.accent }}>Interpretación:</strong> El momentum a corto plazo es favorable
          (oversold bounce) pero los fundamentos a mediano plazo son débiles.
          Considerá tomar ganancias rápido si entrás.
        </div>
      )}
    </div>
  );
}
