'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DailyChallenge, SignalAction, ConfidenceLevel, VerifyResponse } from '@/src/types';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import CandlestickChart from './CandlestickChart';

interface Props {
  challenge: DailyChallenge;
  onVerify: (guess: SignalAction, confidence: ConfidenceLevel) => Promise<VerifyResponse>;
  onRefresh: () => void;
}

const SIGNAL_ACTIONS: { value: SignalAction; label: string; color: string; glow: string }[] = [
  { value: 'COMPRAR', label: 'COMPRAR', color: C.positive, glow: `${C.positive26}` },
  { value: 'MANTENER', label: 'MANTENER', color: C.warning, glow: `${C.warning26}` },
  { value: 'VENDER', label: 'VENDER', color: C.negative, glow: `${C.negative26}` },
];

const CONFIDENCE_LEVELS: { value: ConfidenceLevel; label: string; multiplier: string }[] = [
  { value: 'baja', label: 'Baja', multiplier: '×0.6' },
  { value: 'media', label: 'Media', multiplier: '×0.8' },
  { value: 'alta', label: 'Alta', multiplier: '×1.0' },
];

const CONFETTI_COLORS = [C.positive, C.accent, C.warning, C.info, C.negative, C.accentLight];

function ConfettiExplosion() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 4 + Math.random() * 6,
      delay: Math.random() * 0.3,
      duration: 1.5 + Math.random() * 1.5,
      drift: (Math.random() - 0.5) * 40,
    })), []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 99999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          background: p.color, borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `confettiFall ${p.duration}s ease-out ${p.delay}s forwards`,
          transform: `translateX(${p.drift}px) rotate(${Math.random() * 360}deg)`,
        }} />
      ))}
    </div>
  );
}

function HintCard({ hint, revealed, onClick }: { hint: DailyChallenge['hints'][0]; revealed: boolean; onClick: () => void }) {
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    if (revealed) return;
    setAnimating(true);
    onClick();
    setTimeout(() => setAnimating(false), 400);
  };

  const getValueColor = (key: string, value: string) => {
    if (key === 'rsi') {
      const v = parseFloat(value);
      if (v < 30) return C.positive;
      if (v > 70) return C.negative;
      return C.textPrimary;
    }
    if (key === 'trend') {
      if (value.toLowerCase().includes('alcista')) return C.positive;
      if (value.toLowerCase().includes('bajista')) return C.negative;
      return C.warning;
    }
    if (key === 'targetUpside') {
      if (value.includes('-')) return C.negative;
      const v = parseFloat(value);
      if (v > 15) return C.positive;
      return C.textPrimary;
    }
    if (key === 'pattern') {
      if (value.includes('ALCISTA')) return C.positive;
      if (value.includes('BAJISTA')) return C.negative;
      return C.textSecondary;
    }
    return C.textPrimary;
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: C.bgBase,
        borderRadius: R.md,
        padding: '10px',
        textAlign: 'center',
        cursor: revealed ? 'default' : 'pointer',
        border: revealed
          ? `1px solid ${C.borderLight}`
          : `1px dashed ${C.border}`,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: animating ? 'scale(0.95)' : 'scale(1)',
        animation: animating ? 'hintReveal 0.4s ease' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {!revealed && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, ${C.accent08}, transparent)`,
          pointerEvents: 'none',
        }} />
      )}
      <p style={{
        margin: '0 0 3px', fontSize: '10px',
        color: revealed ? C.textMuted : C.accent,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        fontWeight: revealed ? 500 : 600,
      }}>
        {revealed ? hint.label : '⋯'}
      </p>
      {revealed ? (
        <p style={{
          margin: 0, fontSize: '15px', fontWeight: 700,
          color: getValueColor(hint.key, hint.value),
          animation: 'hintReveal 0.3s ease',
        }}>
          {hint.value}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: '15px', color: C.textMuted, fontWeight: 400 }}>
          Tocar
        </p>
      )}
    </div>
  );
}

export default function ChallengeCard({ challenge, onVerify, onRefresh }: Props) {
  const [selectedAction, setSelectedAction] = useState<SignalAction | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel>('media');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealedHints, setRevealedHints] = useState<Set<string>>(
    new Set(challenge.hints.filter(h => h.revealed).map(h => h.key))
  );

  const revealHint = (key: string) => {
    setRevealedHints(prev => new Set(prev).add(key));
  };

  const handleSubmit = async () => {
    if (!selectedAction || submitting) return;
    setSubmitting(true);
    try {
      const res = await onVerify(selectedAction, confidence);
      setResult(res);
      if (res.correct) setShowConfetti(true);
    } finally {
      setSubmitting(false);
    }
  };

  const hintsRevealedCount = revealedHints.size;
  const bonusText = hintsRevealedCount <= 2 ? '🔥 Reto extremo' :
    hintsRevealedCount <= 4 ? '💪 Buen nivel' : '👍 Dato completo';

  const trend = challenge.hints.find(h => h.key === 'trend')?.value?.toLowerCase() || '';

  if (result) {
    const userAction = SIGNAL_ACTIONS.find(a => a.value === result.userGuess);
    const correctAction = SIGNAL_ACTIONS.find(a => a.value === result.correctSignal);

    return (
      <>
        {showConfetti && <ConfettiExplosion />}
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes resultPop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px ${C.accent40}; }
          50% { box-shadow: 0 0 24px ${C.accent60}; }
        }
        @keyframes hintReveal {
          0% { transform: rotateY(90deg); opacity: 0; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
        <div style={{
          background: C.bgCard,
          borderRadius: R.xl,
          padding: '32px',
          textAlign: 'center',
          animation: 'resultPop 0.4s ease',
          border: `1px solid ${result.correct ? '${C.positive30}' : '${C.negative30}'}`,
          boxShadow: result.correct
            ? `0 0 40px ${C.positive14}`
            : `0 0 20px ${C.negative0d}`,
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: R.full,
            background: result.correct ? `${C.positive18}` : `${C.negative18}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '40px',
            border: `2px solid ${result.correct ? '${C.positive40}' : '${C.negative40}'}`,
            animation: 'glowPulse 2s infinite',
          }}>
            {result.correct ? '🎯' : '💨'}
          </div>

          <h3 style={{ color: C.textPrimary, fontSize: '24px', margin: '0 0 4px' }}>
            {result.correct ? '¡Tiro al Blanco!' : 'No esta vez'}
          </h3>
          <p style={{ color: C.textSecondary, fontSize: F.sizeBase, margin: '0 0 24px' }}>
            {result.correct
              ? 'Coincides con el análisis del motor de señales'
              : 'Sigue practicando, mañana habrá otro reto'}
          </p>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: '24px',
            marginBottom: '24px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: F.sizeXs, color: C.textMuted, textTransform: 'uppercase' }}>Tu señal</p>
              <div style={{
                display: 'inline-block', padding: '6px 20px', borderRadius: R.md,
                background: `${userAction?.color}20`,
                color: userAction?.color,
                fontWeight: 700, fontSize: '18px',
                border: `1px solid ${userAction?.color}40`,
              }}>
                {result.userGuess}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: C.textMuted, fontSize: '24px' }}>
              {result.correct ? '=' : '≠'}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: F.sizeXs, color: C.textMuted, textTransform: 'uppercase' }}>Señal real</p>
              <div style={{
                display: 'inline-block', padding: '6px 20px', borderRadius: R.md,
                background: `${correctAction?.color}20`,
                color: correctAction?.color,
                fontWeight: 700, fontSize: '18px',
                border: `1px solid ${correctAction?.color}40`,
              }}>
                {result.correctSignal}
              </div>
            </div>
          </div>

          <div style={{
            background: result.correct
              ? `linear-gradient(135deg, ${C.positive15}, ${C.positive08})`
              : `linear-gradient(135deg, ${C.negative15}, ${C.negative08})`,
            borderRadius: R.lg,
            padding: '20px',
            marginBottom: '20px',
            border: `1px solid ${result.correct ? '${C.positive20}' : '${C.negative20}'}`,
          }}>
            <p style={{
              fontSize: '36px', fontWeight: 800,
              color: result.correct ? C.positive : C.negative,
              margin: '0 0 2px',
              letterSpacing: '-0.02em',
            }}>
              +{result.score}
              <span style={{ fontSize: F.sizeLg, fontWeight: 500, opacity: 0.6 }}> pts</span>
            </p>
            <p style={{ fontSize: F.sizeBase, color: C.textSecondary, margin: 0 }}>
              Racha: {result.streak} {result.streak === 1 ? 'día' : 'días'} seguidos
              {result.streak >= 3 && ' 🔥'}
              {result.streak >= 5 && ' ⚡'}
              {result.streak >= 10 && ' 💫'}
            </p>
          </div>

          <p style={{
            color: C.textMuted, fontSize: F.sizeMd, lineHeight: '1.6',
            marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px',
          }}>
            {result.explanation}
          </p>

          <button
            onClick={onRefresh}
            style={{
              padding: '14px 40px',
              borderRadius: R.lg,
              border: 'none',
              background: C.gradientPrimary,
              color: C.textPrimary,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '15px',
              transition: 'all 0.15s',
              boxShadow: `0 4px 20px ${C.accent40}`,
            }}
            onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            Siguiente Reto →
          </button>
        </div>
      </>
    );
  }

  const allRevealed = challenge.hints.every(h => revealedHints.has(h.key));

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes resultPop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px ${C.accent40}; }
          50% { box-shadow: 0 0 24px ${C.accent60}; }
        }
        @keyframes hintReveal {
          0% { transform: rotateY(90deg); opacity: 0; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    <div style={{
      background: C.bgCard,
      borderRadius: R.xl,
      animation: 'glowPulse 3s ease-in-out infinite',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: R.lg,
            background: C.gradientPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 700, color: C.textPrimary,
            boxShadow: `0 4px 12px ${C.accent40}`,
          }}>
            {challenge.symbol.charAt(0)}
          </div>
          <div>
            <h3 style={{ margin: 0, color: C.textPrimary, fontSize: '18px', fontWeight: 700 }}>
              {challenge.symbol}
            </h3>
            <p style={{ margin: '2px 0 0', color: C.textMuted, fontSize: F.sizeMd }}>{challenge.name}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: C.textPrimary }}>
            ${challenge.price.toFixed(2)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: F.sizeXs, color: C.textMuted }}>
            {bonusText}
          </p>
        </div>
      </div>

      {/* Candlestick Chart */}
      <div style={{ padding: '12px 16px 0' }}>
        <CandlestickChart
          data={challenge.chartData || []}
          sma50={challenge.sma50}
          support={challenge.support}
          resistance={challenge.resistance}
          trend={challenge.trend}
          height={280}
          animate={true}
        />
      </div>

      {/* Hints grid */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}>
          {challenge.hints.map(hint => (
            <HintCard
              key={hint.key}
              hint={hint}
              revealed={revealedHints.has(hint.key)}
              onClick={() => revealHint(hint.key)}
            />
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 24px 0' }}>
        <p style={{
          fontSize: F.sizeXs, color: C.textMuted, textAlign: 'center',
          fontStyle: 'italic',
        }}>
          {allRevealed
            ? '💡 Todos los datos visibles. Analiza el gráfico + métricas, elige tu veredicto.'
            : `🎯 Toca las tarjetas para revelar datos. Entre menos pistas, más puntos extra.`
          }
        </p>
      </div>

      {/* Signal selector */}
      <div style={{ padding: '16px 24px 0' }}>
        <p style={{
          fontSize: F.sizeMd, color: C.textSecondary, marginBottom: '10px', textAlign: 'center',
          fontWeight: 500,
        }}>
          ¿Cuál es tu veredicto para <strong style={{ color: C.textPrimary }}>{challenge.symbol}</strong>?
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {SIGNAL_ACTIONS.map(action => {
            const isSelected = selectedAction === action.value;
            return (
              <button key={action.value}
                onClick={() => setSelectedAction(action.value)}
                style={{
                  flex: 1,
                  padding: '16px 8px',
                  borderRadius: R.lg,
                  border: `2px solid ${isSelected ? action.color : C.border}`,
                  background: isSelected ? `${action.color}18` : C.bgBase,
                  color: isSelected ? action.color : C.textSecondary,
                  fontWeight: isSelected ? 800 : 500,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                  boxShadow: isSelected ? `0 0 20px ${action.glow}` : 'none',
                  letterSpacing: '0.02em',
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confidence selector */}
      <div style={{ padding: '16px 24px 0' }}>
        <p style={{
          fontSize: F.sizeXs, color: C.textMuted, marginBottom: '8px', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Confianza en tu señal
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {CONFIDENCE_LEVELS.map(cl => (
            <button key={cl.value}
              onClick={() => setConfidence(cl.value)}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: R.md,
                border: `1px solid ${confidence === cl.value ? C.accent : C.border}`,
                background: confidence === cl.value ? `${C.accent18}` : 'transparent',
                color: confidence === cl.value ? C.accent : C.textMuted,
                fontWeight: confidence === cl.value ? 700 : 400,
                fontSize: F.sizeSm,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cl.label}
              <span style={{ fontSize: '10px', opacity: 0.5, display: 'block' }}>{cl.multiplier}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div style={{ padding: '20px 24px 24px' }}>
        <button
          onClick={handleSubmit}
          disabled={!selectedAction || submitting}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: R.lg,
            border: 'none',
            background: !selectedAction
              ? `linear-gradient(135deg, ${C.bgElevated}, ${C.bgElevated})`
              : C.gradientPrimary,
            color: !selectedAction ? C.textMuted : C.textPrimary,
            fontWeight: 800,
            fontSize: F.sizeLg,
            letterSpacing: '0.03em',
            cursor: !selectedAction || submitting ? 'not-allowed' : 'pointer',
            opacity: !selectedAction || submitting ? 0.5 : 1,
            transition: 'all 0.2s',
            boxShadow: selectedAction ? `0 4px 24px ${C.accent50}` : 'none',
          }}
        >
          {submitting ? 'Verificando con el motor de señales...' : '🎯 Confirmar Veredicto'}
        </button>
      </div>
    </div>
    </>
  );
}
