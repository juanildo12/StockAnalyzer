'use client';

import { useState, useMemo } from 'react';
import type { SessionResult, ChallengeResult } from '@/src/types';
import { colors as C, radius as R } from '@/src/utils/webTheme';

interface Props {
  result: SessionResult;
  onNewSession: () => void;
  onBack: () => void;
}

const DIFF_COLORS: Record<string, string> = {
  novato: C.positive, bronce: '#CD7F32', plata: C.textSecondary,
  oro: C.warning, platino: C.info, diamante: C.accentLight,
};

const DIFF_ICONS: Record<string, string> = {
  novato: '🌱', bronce: '🥉', plata: '🥈', oro: '🥇', platino: '💎', diamante: '👑',
};

const LEVEL_NAMES = [
  '', 'Novato', 'Bronce', 'Bronce II', 'Bronce III',
  'Plata', 'Plata II', 'Plata III',
  'Oro', 'Oro II', 'Oro III',
  'Platino', 'Platino II', 'Platino III',
  'Diamante', 'Diamante II', 'Diamante III',
  'Leyenda',
];

const LEVEL_ICONS = [
  '', '🌱', '🥉', '🥉', '🥉',
  '🥈', '🥈', '🥈',
  '🥇', '🥇', '🥇',
  '💎', '💎', '💎',
  '👑', '👑', '👑',
  '⭐',
];

function SignalBadge({ signal }: { signal: string }) {
  const color = signal === 'COMPRAR' ? C.positive : signal === 'VENDER' ? C.negative : C.warning;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: R.sm,
      background: `${color}20`, color, fontWeight: 700, fontSize: '11px',
    }}>
      {signal}
    </span>
  );
}

export default function SessionReview({ result, onNewSession, onBack }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [celebrating, setCelebrating] = useState(result.levelUp);

  const accuracyColor = result.accuracy >= 80 ? C.positive : result.accuracy >= 50 ? C.warning : C.negative;

  const strongAreas = useMemo(() => {
    const metricCount: Record<string, { total: number; correct: number; lessons: string[] }> = {};
    result.results.forEach(r => {
      r.teachingPoints.forEach(tp => {
        if (!metricCount[tp.metric]) metricCount[tp.metric] = { total: 0, correct: 0, lessons: [] };
        metricCount[tp.metric].total++;
        if (tp.impact === 'positivo') metricCount[tp.metric].correct++;
        if (tp.lesson && !metricCount[tp.metric].lessons.includes(tp.lesson)) {
          metricCount[tp.metric].lessons.push(tp.lesson);
        }
      });
    });
    return Object.entries(metricCount)
      .filter(([_, v]) => v.total > 0)
      .map(([k, v]) => ({ metric: k, score: Math.round((v.correct / v.total) * 100), lessons: v.lessons }))
      .sort((a, b) => b.score - a.score);
  }, [result.results]);

  return (
    <div style={{ animation: 'slideUp 0.5s ease' }}>
      {/* Level up celebration */}
      {celebrating && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          animation: 'fadeIn 0.3s ease',
        }} onClick={() => setCelebrating(false)}>
          <div style={{ textAlign: 'center', animation: 'bounceIn 0.6s ease' }}>
            <div style={{ fontSize: '72px', marginBottom: '12px', animation: 'spin 2s linear infinite' }}>
              {LEVEL_ICONS[result.newLevel] || '⭐'}
            </div>
            <h2 style={{ color: C.textPrimary, fontSize: '32px', margin: '0 0 8px' }}>
              ¡Nivel {result.newLevel}!
            </h2>
            <p style={{ color: C.warning, fontSize: '18px', margin: '0 0 4px', fontWeight: 700 }}>
              {LEVEL_NAMES[result.newLevel] || 'Leyenda'}
            </p>
            <p style={{ color: C.textMuted, fontSize: '14px', marginBottom: '20px' }}>
              {result.newLevel >= 1 && result.newLevel <= 2 ? '🌱 Las pistas se reducen, los retos se intensifican' :
               result.newLevel >= 3 && result.newLevel <= 4 ? '🥉 Sesiones de trading desbloqueadas' :
               result.newLevel >= 5 && result.newLevel <= 7 ? '🥈 Timer activado en sesiones' :
               result.newLevel >= 8 && result.newLevel <= 10 ? '🥇 Sin pistas pre-reveladas. Confía en tu análisis' :
               result.newLevel >= 11 && result.newLevel <= 13 ? '💎 Acciones volátiles. Velocidad y precisión' :
               result.newLevel >= 14 ? '👑 Eres un trader de élite' : 'Sigue así'}
            </p>
            <div style={{
              width: '160px', height: '4px', background: C.bgBase, borderRadius: '2px',
              margin: '0 auto 24px', overflow: 'hidden',
            }}>
              <div style={{
                width: '100%', height: '100%',
                background: `linear-gradient(90deg, ${C.positive}, ${C.warning}, ${C.accentLight})`,
                animation: 'shimmer 1.5s ease infinite',
              }} />
            </div>
            <button
              onClick={() => setCelebrating(false)}
              style={{
                padding: '14px 40px', borderRadius: R.lg, border: 'none',
                background: C.gradientPrimary, color: C.textPrimary, fontWeight: 700,
                fontSize: '16px', cursor: 'pointer',
                boxShadow: `0 4px 30px ${C.accent60}`,
              }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Hero score */}
        <div style={{
          background: C.bgCard, borderRadius: R.xl, padding: '32px', textAlign: 'center',
          marginBottom: '16px', border: `1px solid ${C.borderLight}`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: `radial-gradient(circle at 50% 50%, ${DIFF_COLORS[result.difficulty]}08, transparent 60%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ fontSize: '40px', marginBottom: '8px' }}>{DIFF_ICONS[result.difficulty]}</div>
          <p style={{ color: C.textMuted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Sesión {result.difficulty.charAt(0).toUpperCase() + result.difficulty.slice(1)} • {result.total} retos
          </p>
          <p style={{
            fontSize: '48px', fontWeight: 800, color: C.textPrimary, margin: '0 0 4px',
            letterSpacing: '-0.02em',
          }}>
            {result.totalScore}
            <span style={{ fontSize: '18px', fontWeight: 500, color: C.textMuted }}> pts</span>
          </p>
          {result.levelUp && (
            <p style={{ color: '#F59E0B', fontSize: '14px', fontWeight: 600, margin: 0 }}>
              🎉 ¡Subiste al nivel {result.newLevel} — {LEVEL_NAMES[result.newLevel]}!
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Aciertos', value: `${result.correct}/${result.total}`, color: accuracyColor },
            { label: 'Precisión', value: `${result.accuracy}%`, color: accuracyColor },
            { label: 'Tiempo prom.', value: `${result.averageTime}s`, color: C.textPrimary },
            { label: 'Racha', value: `${result.bestStreak}`, color: C.warning },
          ].map(stat => (
            <div key={stat.label} style={{
              background: C.bgCard, borderRadius: R.lg, padding: '14px 8px', textAlign: 'center',
              border: `1px solid ${C.borderLight}`,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: stat.color }}>
                {stat.value}
              </p>
              <p style={{ margin: 0, fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Results list */}
        <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '20px', marginBottom: '16px', border: `1px solid ${C.borderLight}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ margin: 0, color: C.textPrimary, fontWeight: 600, fontSize: '14px' }}>
              Resultados por reto
            </p>
            <button onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'transparent', border: 'none', color: C.accent,
                cursor: 'pointer', fontSize: '12px', fontWeight: 500,
              }}
            >
              {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.results.map((r, i) => {
              const color = r.correct ? `${C.positive20}` : `${C.negative20}`;
              const border = r.correct ? `${C.positive30}` : `${C.negative30}`;
              return (
                <div key={i} style={{
                  background: color, borderRadius: R.md, padding: '10px 14px',
                  border: `1px solid ${border}`, cursor: showDetails ? 'default' : 'pointer',
                }}
                  onClick={() => !showDetails && setShowDetails(true)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{r.correct ? '✅' : '❌'}</span>
                      <div>
                        <p style={{ margin: 0, color: C.textPrimary, fontWeight: 600, fontSize: '13px' }}>
                          {r.symbol}
                        </p>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                          <SignalBadge signal={r.userGuess} />
                          <span style={{ color: C.textMuted, fontSize: '11px' }}>→</span>
                          <SignalBadge signal={r.correctSignal} />
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, color: C.warning, fontWeight: 700, fontSize: '14px' }}>
                        +{r.score}
                      </p>
                      <p style={{ margin: 0, color: C.textMuted, fontSize: '10px' }}>
                        {r.timeSeconds}s • ×{r.confidence === 'alta' ? 1 : r.confidence === 'media' ? 0.8 : 0.6}
                      </p>
                    </div>
                  </div>

                  {/* Teaching points */}
                  {showDetails && r.teachingPoints.length > 0 && (
                    <div style={{
                      marginTop: '10px', paddingTop: '10px',
                      borderTop: `1px solid ${C.borderLight}`,
                    }}>
                      <p style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
                        Puntos de aprendizaje
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {r.teachingPoints.map((tp, j) => (
                          <div key={j} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '6px',
                            fontSize: '12px', color: C.textSecondary, lineHeight: '1.4',
                          }}>
                            <span style={{
                              flexShrink: 0,
                              color: tp.impact === 'positivo' ? C.positive : tp.impact === 'negativo' ? C.negative : C.textMuted,
                            }}>
                              {tp.impact === 'positivo' ? '▲' : tp.impact === 'negativo' ? '▼' : '●'}
                            </span>
                            <span><strong>{tp.metric}:</strong> {tp.lesson}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Strong areas */}
        {strongAreas.length > 0 && (
          <div style={{
            background: C.bgCard, borderRadius: R.xl, padding: '20px',
            marginBottom: '16px', border: `1px solid ${C.borderLight}`,
          }}>
            <p style={{ margin: '0 0 12px', color: C.textPrimary, fontWeight: 600, fontSize: '14px' }}>
              📊 Áreas de fortaleza
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {strongAreas.map((area, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: C.textSecondary, fontSize: '12px' }}>{area.metric}</span>
                    <span style={{
                      color: area.score >= 70 ? C.positive : area.score >= 40 ? C.warning : C.negative,
                      fontWeight: 700, fontSize: '12px',
                    }}>
                      {area.score}%
                    </span>
                  </div>
                  <div style={{ height: '4px', background: C.bgBase, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${area.score}%`, height: '100%',
                      background: area.score >= 70 ? C.positive : area.score >= 40 ? C.warning : C.negative,
                      borderRadius: '2px', transition: 'width 0.5s ease',
                    }} />
                  </div>
                  {area.lessons.length > 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: C.textMuted, lineHeight: '1.4' }}>
                      💡 {area.lessons[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', paddingBottom: '20px' }}>
          <button onClick={onNewSession}
            style={{
              padding: '14px 32px', borderRadius: R.lg, border: 'none',
              background: C.gradientPrimary, color: C.textPrimary, fontWeight: 700,
              fontSize: '15px', cursor: 'pointer',
              boxShadow: `0 4px 20px ${C.accent40}`,
            }}
          >
            Nueva Sesión →
          </button>
          <button onClick={onBack}
            style={{
              padding: '14px 24px', borderRadius: R.lg, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textSecondary, cursor: 'pointer', fontSize: '14px',
            }}
          >
            Volver al menú
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
