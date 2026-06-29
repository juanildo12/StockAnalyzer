'use client';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

import { useState } from 'react';

const signals = [
  {
    id: 'signal',
    icon: '📊',
    title: 'Signal Score (0–100)',
    desc: 'Puntaje compuesto que integra valoración, fundamentales, análisis técnico, valor Graham, NNWC y consenso de analistas. Un score ≥ 65 indica COMPRAR, 40–64 MANTENER, < 40 VENDER.',
    color: C.accent,
  },
  {
    id: 'valuation',
    icon: '💰',
    title: 'Valoración',
    desc: 'Evalúa si el precio actual es razonable vs el valor intrínseco. Combina PE ratio, target de analistas, margen de seguridad de Graham y descuento NNWC. Una valoración baja = oportunidad.',
    color: C.positive,
  },
  {
    id: 'fundamental',
    icon: '📊',
    title: 'Fundamental (10 Principios)',
    desc: 'Basado en los 10 principios de Benjamin Graham: deuda manejable, márgenes de beneficio saludables, crecimiento de ingresos, ROE sólido y más. Cada principio que se cumple suma 10 puntos.',
    color: C.warning,
  },
  {
    id: 'technical',
    icon: '📈',
    title: 'Técnico',
    desc: 'Analiza tendencia (alcista/bajista/lateral) y RSI (sobrecompra/sobreventa). Tendencia alcista + RSI neutral = señal positiva. Tendencia bajista o RSI extremo = señal negativa.',
    color: C.warning,
  },
  {
    id: 'graham',
    icon: '🧮',
    title: 'Valor Graham (NCAV)',
    desc: 'Calcula el valor intrínseco según la fórmula de Benjamin Graham: √(22.5 × EPS × BVPS). Si el precio actual está por debajo, hay margen de seguridad. Ideal para inversionistas value.',
    color: C.accentLight,
  },
  {
    id: 'nnwc',
    icon: '💵',
    title: 'NNWC (Net Net Working Capital)',
    desc: 'Estrategia de Graham: calcula el efectivo neto ajustado por acción. Si la acción cotiza por debajo del NNWC, está potencialmente infravalorada. Oportunidades deep value.',
    color: C.positive,
  },
  {
    id: 'analyst',
    icon: '🎯',
    title: 'Consenso de Analistas',
    desc: 'Agrega precios objetivo de analistas de Wall Street. Compara el target medio vs precio actual. Un target significativamente superior indica potencial alcista.',
    color: C.accent,
  },
  {
    id: 'conviction',
    icon: '🔥',
    title: 'Convicción',
    desc: 'Alta: señal muy clara (score ≥ 80 o ≤ 20). Media: señal moderada (score 60–79 o 21–35). Baja: señal débil. A mayor convicción, mayor confianza en la señal.',
    color: C.negative,
  },
  {
    id: 'risk',
    icon: '⚠️',
    title: 'Nivel de Riesgo',
    desc: 'Alto: 3+ factores de riesgo (tendencia bajista, RSI sobrecompra, deuda excesiva, Graham bajo). Medio: 1–2 factores. Bajo: sin factores de riesgo significativos.',
    color: C.warning,
  },
  {
    id: 'bullsbears',
    icon: '🐂',
    title: 'Bulls & Bears',
    desc: 'Short-Term Bull: BUY + convicción alta + tendencia alcista. Short-Term Bear: SELL + convicción alta + tendencia bajista. Long-Term Bull: BUY + score ≥ 70. Long-Term Bear: SELL + score < 40.',
    color: C.positive,
  },
];

interface LearningGuideProps {
  onClose: () => void;
}

export default function LearningGuide({ onClose }: LearningGuideProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.bgCard,
          borderRadius: '16px',
          border: '1px solid ' + C.border,
          maxWidth: '640px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '20px', fontWeight: '700' }}>📖 Guía de Señales</h2>
            <p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: '13px' }}>Aprende a interpretar cada componente del análisis</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '22px', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ overflow: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {signals.map(s => (
              <div
                key={s.id}
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                style={{
                  background: expanded === s.id ? '#1a2332' : C.bg,
                  borderRadius: '10px',
                  border: expanded === s.id ? `1px solid ${s.color}40` : '1px solid ' + C.borderLight,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                  <span style={{ fontSize: '20px' }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.textPrimary, fontWeight: '600', fontSize: '14px' }}>{s.title}</div>
                    {expanded !== s.id && (
                      <div style={{ color: C.textMuted, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {s.desc}
                      </div>
                    )}
                  </div>
                  <span style={{ color: C.textMuted, fontSize: '14px', transition: 'transform 0.2s', transform: expanded === s.id ? 'rotate(180deg)' : 'none' }}>
                    ▼
                  </span>
                </div>
                {expanded === s.id && (
                  <div style={{ padding: '0 16px 12px 52px', color: C.textSecondary, fontSize: '13px', lineHeight: '1.5' }}>
                    {s.desc}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid ' + C.border, textAlign: 'center' }}>
          <p style={{ margin: 0, color: C.textMuted, fontSize: '12px' }}>
            Basado en los principios de Benjamin Graham, análisis técnico y value investing
          </p>
        </div>
      </div>
    </div>
  );
}
