'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SessionChallenge, ChallengeResult, SessionResult, SignalAction, ConfidenceLevel, DifficultyTier, TeachingPoint } from '@/src/types';
import { colors as C, radius as R } from '@/src/utils/webTheme';
import CandlestickChart from './CandlestickChart';

interface Props {
  difficulty: DifficultyTier;
  onComplete: (result: SessionResult) => void;
  onCancel: () => void;
  level: number;
}

const SIGNAL_ACTIONS: { value: SignalAction; label: string; color: string; glow: string }[] = [
  { value: 'COMPRAR', label: 'COMPRAR', color: C.positive, glow: 'rgba(34,197,94,0.15)' },
  { value: 'MANTENER', label: 'MANTENER', color: C.warning, glow: 'rgba(245,158,11,0.15)' },
  { value: 'VENDER', label: 'VENDER', color: C.negative, glow: 'rgba(239,68,68,0.15)' },
];

const CONFIDENCE_LEVELS: { value: ConfidenceLevel; label: string; mult: number }[] = [
  { value: 'baja', label: 'Baja', mult: 0.6 },
  { value: 'media', label: 'Media', mult: 0.8 },
  { value: 'alta', label: 'Alta', mult: 1.0 },
];

const SCORE_MULTIPLIERS: Record<DifficultyTier, number> = {
  novato: 1, bronce: 1.2, plata: 1.5, oro: 2, platino: 3, diamante: 5,
};

const DIFFICULTY_LABELS: Record<DifficultyTier, string> = {
  novato: 'Novato', bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', diamante: 'Diamante',
};

const DIFFICULTY_COLORS: Record<DifficultyTier, string> = {
  novato: C.positive, bronce: '#CD7F32', plata: C.textSecondary, oro: C.warning, platino: C.info, diamante: C.accentLight,
};

function TimerBar({ seconds, running, onTimeout }: { seconds: number; running: boolean; onTimeout: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const pct = seconds > 0 ? (remaining / seconds) * 100 : 100;
  const color = remaining > seconds * 0.5 ? C.positive : remaining > seconds * 0.25 ? C.warning : C.negative;

  useEffect(() => {
    if (!running || seconds <= 0) return;
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, seconds]);

  if (seconds <= 0) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase' }}>Tiempo restante</span>
        <span style={{ fontSize: '11px', color, fontWeight: 700 }}>
          {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
        </span>
      </div>
      <div style={{ height: '4px', background: C.bgBase, borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: '2px', transition: 'width 1s linear',
        }} />
      </div>
    </div>
  );
}

export default function GameSession({ difficulty, onComplete, onCancel, level }: Props) {
  const [challenges, setChallenges] = useState<SessionChallenge[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAction, setSelectedAction] = useState<SignalAction | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel>('media');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; score: number; symbol: string; correctSignal: string } | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const [sessionInProgress, setSessionInProgress] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = challenges[currentIdx];

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', difficulty }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error starting session');
      }
      const json = await res.json();
      if (!json.challenges || json.challenges.length === 0) {
        throw new Error('No se pudieron generar retos. Intenta de nuevo.');
      }
      setChallenges(json.challenges);
      setStartTime(Date.now());
      setSessionInProgress(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [difficulty]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const revealHint = (key: string) => {
    if (revealedHints.has(key)) return;
    setRevealedHints(prev => new Set(prev).add(key));
    setHintsUsed(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!selectedAction || !current || submitting) return;
    setSubmitting(true);
    const timeSeconds = Math.round((Date.now() - startTime) / 1000);

    try {
      const res = await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          challengeIndex: currentIdx,
          userGuess: selectedAction,
          confidence,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error verifying');
      }
      const json = await res.json();

      const multiplier = SCORE_MULTIPLIERS[difficulty];
      const hintPenalty = hintsUsed * 5;
      const timeBonus = currentIdx > 0 ? Math.max(0, Math.round((timeSeconds < 30 ? 30 - timeSeconds : 0) * 0.5)) : 0;
      const streakBonus = results.length > 0 ? Math.min(results.filter(r => r.correct).length * 10, 50) : 0;
      const finalScore = Math.round(Math.max(0, json.score * multiplier + timeBonus + streakBonus - hintPenalty));

      const teachingPoints: TeachingPoint[] = generateTeaching(current, json.correct, selectedAction);

      const result: ChallengeResult = {
        index: currentIdx,
        symbol: current.symbol,
        userGuess: selectedAction,
        correctSignal: json.correctSignal as SignalAction,
        correct: json.correct,
        confidence,
        score: finalScore,
        timeSeconds,
        hintsUsed,
        teachingPoints,
      };

      setResults(prev => [...prev, result]);
      setFeedback({ correct: json.correct, score: finalScore, symbol: current.symbol, correctSignal: json.correctSignal });

      timerRef.current = setTimeout(() => {
        if (currentIdx < challenges.length - 1) {
          setCurrentIdx(prev => prev + 1);
          setSelectedAction(null);
          setConfidence('media');
          setFeedback(null);
          setHintsUsed(0);
          setRevealedHints(new Set());
          setStartTime(Date.now());
        } else {
          endSession([...results, result]);
        }
        setSubmitting(false);
      }, json.correct ? 1800 : 2600);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const endSession = async (finalResults: ChallengeResult[]) => {
    try {
      await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      });
    } catch {}

    const correct = finalResults.filter(r => r.correct).length;
    const totalScore = finalResults.reduce((s, r) => s + r.score, 0);
    const maxPossible = challenges.length * 100 * SCORE_MULTIPLIERS[difficulty];
    const avgTime = Math.round(finalResults.reduce((s, r) => s + r.timeSeconds, 0) / finalResults.length);
    const accuracy = Math.round((correct / finalResults.length) * 100);
    const allCorrect = finalResults.filter(r => r.correct);

    let newLevel = level;
    const scoreThresholds = [0, 500, 1200, 2200, 3600, 5500, 8000, 11000, 15000, 20000, 26000, 33000, 41000, 50000, 60000];
    let cumulativeScore = totalScore;
    for (let i = scoreThresholds.length - 1; i >= 0; i--) {
      if (cumulativeScore >= scoreThresholds[i]) { newLevel = i + 1; break; }
    }

    const totalMax = finalResults.length > 0
      ? Math.round(finalResults.length * 100 * SCORE_MULTIPLIERS[difficulty] * 1.3)
      : 0;

    const sessionResult: SessionResult = {
      totalScore,
      maxScore: totalMax,
      correct,
      total: finalResults.length,
      accuracy,
      averageTime: avgTime,
      difficulty,
      levelUp: newLevel > level,
      newLevel,
      streak: allCorrect.length,
      bestStreak: Math.max(...finalResults.map(r => r.correct ? 1 : 0).join('').split('0').map(s => s.length)),
      results: finalResults,
    };

    onComplete(sessionResult);
  };

  const handleTimeout = () => {
    if (!selectedAction) {
      setSelectedAction('MANTENER');
      setConfidence('baja');
      setTimeout(() => handleSubmit(), 100);
    }
  };

  const streak = results.filter(r => r.correct).length;
  const progressPct = challenges.length > 0 ? ((currentIdx + 1) / challenges.length) * 100 : 0;

  if (loading) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '60px 24px', textAlign: 'center' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          border: `3px solid ${C.border}`, borderTopColor: DIFFICULTY_COLORS[difficulty],
          animation: 'spin 1s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ color: C.textSecondary, fontSize: '15px', marginBottom: '4px' }}>
          Generando sesión de {DIFFICULTY_LABELS[difficulty]}...
        </p>
        <p style={{ color: C.textMuted, fontSize: '13px' }}>
          Preparando retos con datos en vivo
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
        <p style={{ color: C.negative, fontSize: '14px', marginBottom: '20px' }}>{error}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={fetchSession} style={{
            padding: '12px 24px', borderRadius: R.lg, border: 'none',
            background: C.gradientPrimary, color: C.textPrimary, fontWeight: 600, cursor: 'pointer',
          }}>
            Reintentar
          </button>
          <button onClick={onCancel} style={{
            padding: '12px 24px', borderRadius: R.lg, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.textSecondary, cursor: 'pointer',
          }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: C.textSecondary }}>No hay retos disponibles.</p>
        <button onClick={fetchSession} style={{
          padding: '12px 24px', borderRadius: R.lg, border: 'none',
          background: C.gradientPrimary, color: C.textPrimary, fontWeight: 600, cursor: 'pointer', marginTop: '16px',
        }}>
          Reintentar
        </button>
      </div>
    );
  }

  const allRevealed = current.hints.every(h => revealedHints.has(h.key));
  const hintBudgetUsed = hintsUsed;

  return (
    <div style={{ background: C.bgCard, borderRadius: R.xl, overflow: 'hidden' }}>
      {/* Session header */}
      <div style={{
        background: `linear-gradient(135deg, ${DIFFICULTY_COLORS[difficulty]}15, transparent)`,
        padding: '16px 20px', borderBottom: `1px solid ${C.borderLight}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: DIFFICULTY_COLORS[difficulty] + '25',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>
              {DIFFICULTY_LABELS[difficulty] === 'Novato' ? '🌱' :
               DIFFICULTY_LABELS[difficulty] === 'Bronce' ? '🥉' :
               DIFFICULTY_LABELS[difficulty] === 'Plata' ? '🥈' :
               DIFFICULTY_LABELS[difficulty] === 'Oro' ? '🥇' :
               DIFFICULTY_LABELS[difficulty] === 'Platino' ? '💎' : '👑'}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sesión {DIFFICULTY_LABELS[difficulty]} • Reto {currentIdx + 1}/{challenges.length}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: C.textSecondary }}>
                Racha: {streak} ✓ • Pistas usadas: {hintBudgetUsed}
              </p>
            </div>
          </div>
          <div style={{ fontSize: '13px', color: DIFFICULTY_COLORS[difficulty], fontWeight: 700 }}>
            ×{SCORE_MULTIPLIERS[difficulty]}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: '3px', background: C.bgBase, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPct}%`, height: '100%',
            background: DIFFICULTY_COLORS[difficulty],
            borderRadius: '2px', transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Timer */}
        <TimerBar
          seconds={difficulty === 'novato' || difficulty === 'bronce' ? 0 :
            difficulty === 'plata' ? 75 : difficulty === 'oro' ? 55 :
            difficulty === 'platino' ? 35 : 20}
          running={!feedback && !submitting}
          onTimeout={handleTimeout}
        />

        {/* Feedback overlay */}
        {feedback ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            animation: 'fadeSlideIn 0.3s ease',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: feedback.correct ? `${C.positive18}` : `${C.negative18}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: '32px',
              border: `2px solid ${feedback.correct ? `${C.positive40}` : `${C.negative40}`}`,
            }}>
              {feedback.correct ? '✓' : '✗'}
            </div>
            <p style={{
              fontSize: '22px', fontWeight: 700,
              color: feedback.correct ? C.positive : C.negative,
              margin: '0 0 4px',
            }}>
              {feedback.correct ? '¡Correcto!' : 'No esta vez'}
            </p>
            <p style={{ color: C.textSecondary, fontSize: '13px', margin: '0 0 8px' }}>
              {feedback.symbol}: {feedback.correctSignal}
            </p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: C.warning, margin: 0 }}>
              +{feedback.score} pts
            </p>
          </div>
        ) : (
          <>
            {/* Challenge content */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, color: C.textPrimary, fontSize: '20px', fontWeight: 700 }}>
                  {current.symbol}
                </h3>
                <p style={{ margin: '2px 0 0', color: C.textMuted, fontSize: '13px' }}>{current.name}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: C.textPrimary }}>
                  ${current.price.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Candlestick chart */}
            <div style={{ marginBottom: '12px' }}>
              <CandlestickChart
                data={current.chartData || []}
                sma50={current.sma50}
                support={current.support}
                resistance={current.resistance}
                trend={current.trend}
                height={220}
                animate={true}
              />
            </div>

            {/* Hints */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '16px' }}>
              {current.hints.map(hint => {
                const rev = revealedHints.has(hint.key);
                return (
                  <div key={hint.key} onClick={() => !rev && revealHint(hint.key)}
                    style={{
                      background: C.bgBase, borderRadius: R.md, padding: '8px', textAlign: 'center',
                      cursor: rev ? 'default' : 'pointer',
                      border: rev ? `1px solid ${C.borderLight}` : `1px dashed ${C.border}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    <p style={{
                      margin: '0 0 2px', fontSize: '9px', textTransform: 'uppercase',
                      color: rev ? C.textMuted : C.accent, letterSpacing: '0.04em',
                      fontWeight: rev ? 500 : 600,
                    }}>
                      {rev ? hint.label : '⋯'}
                    </p>
                    <p style={{
                      margin: 0, fontSize: '13px', fontWeight: 700,
                      color: rev ? C.positive : C.textMuted,
                    }}>
                      {rev ? hint.value : 'Tocar'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Signal picker */}
            <p style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '8px', textAlign: 'center', fontWeight: 500 }}>
              Tu veredicto para <strong style={{ color: C.textPrimary }}>{current.symbol}</strong>
            </p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {SIGNAL_ACTIONS.map(action => {
                const isSelected = selectedAction === action.value;
                return (
                  <button key={action.value}
                    onClick={() => setSelectedAction(action.value)}
                    style={{
                      flex: 1, padding: '14px 6px', borderRadius: R.lg,
                      border: `2px solid ${isSelected ? action.color : C.border}`,
                      background: isSelected ? `${action.color}18` : C.bgBase,
                      color: isSelected ? action.color : C.textSecondary,
                      fontWeight: isSelected ? 800 : 500,
                      fontSize: '14px', cursor: 'pointer',
                      transition: 'all 0.15s',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>

            {/* Confidence */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              {CONFIDENCE_LEVELS.map(cl => (
                <button key={cl.value}
                  onClick={() => setConfidence(cl.value)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: R.md,
                    border: `1px solid ${confidence === cl.value ? C.accent : C.border}`,
                    background: confidence === cl.value ? `${C.accent18}` : 'transparent',
                    color: confidence === cl.value ? C.accent : C.textMuted,
                    fontWeight: confidence === cl.value ? 700 : 400,
                    fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {cl.label} ×{cl.mult}
                </button>
              ))}
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={!selectedAction || submitting}
              style={{
                width: '100%', padding: '14px', borderRadius: R.lg, border: 'none',
                background: !selectedAction ? C.border : C.gradientPrimary,
                color: !selectedAction ? C.textMuted : C.textPrimary,
                fontWeight: 700, fontSize: '15px',
                cursor: !selectedAction ? 'not-allowed' : 'pointer',
                opacity: !selectedAction ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {submitting ? 'Verificando...' : `🎯 Enviar Veredicto`}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function generateTeaching(challenge: SessionChallenge, correct: boolean, guess: SignalAction): TeachingPoint[] {
  const points: TeachingPoint[] = [];
  const rsiHint = challenge.hints.find(h => h.key === 'rsi');
  const trendHint = challenge.hints.find(h => h.key === 'trend');
  const peHint = challenge.hints.find(h => h.key === 'peRatio');
  const targetHint = challenge.hints.find(h => h.key === 'target');
  const rangeHint = challenge.hints.find(h => h.key === 'range');

  if (rsiHint) {
    const rsi = parseFloat(rsiHint.value);
    let lesson = '';
    if (rsi < 30) lesson = 'RSI bajo indica sobreventa, posible rebote alcista';
    else if (rsi > 70) lesson = 'RSI alto indica sobrecompra, posible corrección';
    else lesson = 'RSI en zona neutral, sin señal extremo';
    points.push({ metric: 'RSI', value: rsiHint.value, impact: rsi < 30 ? 'positivo' : rsi > 70 ? 'negativo' : 'neutral', lesson });
  }
  if (trendHint) {
    const t = trendHint.value.toLowerCase();
    points.push({
      metric: 'Tendencia', value: trendHint.value,
      impact: t.includes('alcista') ? 'positivo' : t.includes('bajista') ? 'negativo' : 'neutral',
      lesson: t.includes('alcista') ? 'Tendencia alcista: SMA50 sobre SMA200, momento favorable' :
        t.includes('bajista') ? 'Tendencia bajista: SMA50 bajo SMA200, precaución' :
        'Tendencia lateral: sin dirección clara, esperar confirmación',
    });
  }
  if (peHint && parseFloat(peHint.value) > 0) {
    const pe = parseFloat(peHint.value);
    points.push({
      metric: 'PE Ratio', value: peHint.value,
      impact: pe < 15 ? 'positivo' : pe < 25 ? 'neutral' : 'negativo',
      lesson: pe < 15 ? 'PE bajo sugiere acción infravalorada' :
        pe < 25 ? 'PE en rango razonable' :
        'PE elevado, expectativas de crecimiento ya descontadas',
    });
  }
  if (targetHint && targetHint.value !== 'N/A') {
    const up = parseFloat(targetHint.value);
    points.push({
      metric: 'Target Upside', value: targetHint.value,
      impact: up > 10 ? 'positivo' : up < 0 ? 'negativo' : 'neutral',
      lesson: up > 15 ? 'Gran potencial según analistas' :
        up > 0 ? 'Ligero optimismo de analistas' :
        'Analistas ven riesgo bajista',
    });
  }
  if (rangeHint && rangeHint.value !== 'N/A') {
    const pos = parseFloat(rangeHint.value);
    points.push({
      metric: 'Posición 52sem', value: rangeHint.value,
      impact: pos < 20 ? 'positivo' : pos > 90 ? 'negativo' : 'neutral',
      lesson: pos < 20 ? 'Cerca del mínimo anual, posible punto de entrada' :
        pos > 90 ? 'Cerca del máximo anual, esperar retroceso' :
        'En medio del rango anual',
    });
  }

  if (!correct) {
    const wrongDirection = guess === 'COMPRAR' ? 'alcista' : guess === 'VENDER' ? 'bajista' : 'neutral';
    points.push({
      metric: 'Clave', value: 'Aprende',
      impact: 'negativo',
      lesson: `Tu señal fue ${guess}. Para mejorar, enfócate en los indicadores que contradicen tu postura ${wrongDirection}.`,
    });
  }

  return points;
}
