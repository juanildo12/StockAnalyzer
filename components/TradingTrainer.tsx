'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailyChallenge, VerifyResponse, GameState, SignalAction, ConfidenceLevel, Achievement, SessionResult, DifficultyTier } from '@/src/types';
import { colors as C, radius as R } from '@/src/utils/webTheme';
import ChallengeCard from './ChallengeCard';
import GameProgress from './GameProgress';
import FreePractice from './FreePractice';
import GameSession from './GameSession';
import SessionReview from './SessionReview';
import ThinkingOrbLoader from '@/src/components/ThinkingOrbLoader';

const STORAGE_KEY = 'trading-trainer-state';
const ACHIEVEMENTS_CONFIG: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'first-win', name: 'Primer Acierto', description: 'Acertar 1 reto diario', icon: '🎯' },
  { id: 'streak-3', name: 'Racha 3', description: '3 seguidos correctos', icon: '🔥' },
  { id: 'streak-5', name: 'Racha 5', description: '5 seguidos correctos', icon: '⚡' },
  { id: 'streak-10', name: 'Racha 10', description: '10 seguidos correctos', icon: '💫' },
  { id: 'analyst-10', name: 'Analista en Formación', description: '10 aciertos totales', icon: '📊' },
  { id: 'consistency', name: 'Trader Consistency', description: 'Score >70% en 20 retos', icon: '🏆' },
  { id: 'session-master', name: 'Maestro de Sesiones', description: 'Completar 5 sesiones', icon: '🎮' },
  { id: 'speed-trader', name: 'Velocista', description: 'Completar sesión Oro+ con >80% aciertos', icon: '⚡' },
];

const DIFFICULTIES: { id: DifficultyTier; icon: string; name: string; minLevel: number; hints: string; timer: string; challenges: number; desc: string }[] = [
  { id: 'novato', icon: '🌱', name: 'Novato', minLevel: 1, hints: '4 pistas', timer: 'Sin límite', challenges: 5, desc: 'Perfecto para empezar. Muchas pistas, acciones conocidas.' },
  { id: 'bronce', icon: '🥉', name: 'Bronce', minLevel: 3, hints: '2 pistas', timer: 'Sin límite', challenges: 5, desc: 'Menos pistas. Empieza a confiar en tu análisis.' },
  { id: 'plata', icon: '🥈', name: 'Plata', minLevel: 5, hints: '1 pista', timer: '75s por reto', challenges: 7, desc: 'Timer activado. Presión controlada, acciones variadas.' },
  { id: 'oro', icon: '🥇', name: 'Oro', minLevel: 8, hints: '0 pistas', timer: '55s por reto', challenges: 7, desc: 'Sin pistas iniciales. Solo tú y el gráfico.' },
  { id: 'platino', icon: '💎', name: 'Platino', minLevel: 11, hints: '0 pistas', timer: '35s por reto', challenges: 10, desc: 'Acciones volátiles. Decisiones rápidas y precisas.' },
  { id: 'diamante', icon: '👑', name: 'Diamante', minLevel: 15, hints: '0 pistas', timer: '20s por reto', challenges: 10, desc: 'Élite. Acciones complejas, presión máxima.' },
];

const TIER_COLORS: Record<DifficultyTier, string> = {
  novato: C.positive, bronce: '#CD7F32', plata: C.textSecondary,
  oro: C.warning, platino: C.info, diamante: C.accentLight,
};

function defaultState(): GameState {
  return {
    totalScore: 0,
    streak: 0,
    bestStreak: 0,
    challengesCompleted: 0,
    challengesCorrect: 0,
    todayCompleted: false,
    lastChallengeDate: '',
    achievements: [],
    level: 1,
    history: [],
    sessionsCompleted: 0,
    totalTimePlayed: 0,
  };
}

function loadState(): GameState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch {}
  return defaultState();
}

function saveState(state: GameState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function checkAchievements(state: GameState): Achievement[] {
  const unlocked = new Set(state.achievements.map(a => a.id));
  const newAchievements: Achievement[] = [];
  const now = new Date().toISOString();

  const checks: [string, boolean][] = [
    ['first-win', state.challengesCorrect >= 1],
    ['streak-3', state.streak >= 3],
    ['streak-5', state.streak >= 5],
    ['streak-10', state.streak >= 10],
    ['analyst-10', state.challengesCorrect >= 10],
    ['consistency', state.challengesCompleted >= 20 && state.challengesCompleted > 0 &&
      (state.challengesCorrect / state.challengesCompleted) >= 0.7],
    ['session-master', state.sessionsCompleted >= 5],
  ];

  for (const [id, condition] of checks) {
    if (!unlocked.has(id) && condition) {
      const config = ACHIEVEMENTS_CONFIG.find(a => a.id === id);
      if (config) {
        newAchievements.push({ ...config, unlockedAt: now });
      }
    }
  }
  return [...state.achievements, ...newAchievements];
}

function getLevelFromScore(score: number): number {
  const thresholds = [0, 400, 900, 1500, 2200, 3000, 4000, 5200, 6600, 8200, 10000, 13000, 16000, 20000, 25000, 30000, 40000];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (score >= thresholds[i]) return i + 1;
  }
  return 1;
}

export default function TradingTrainer() {
  const [activeTab, setActiveTab] = useState<'daily' | 'session' | 'practice' | 'progress'>('daily');
  const [gameState, setGameState] = useState<GameState>(defaultState);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionView, setSessionView] = useState<'select' | 'playing' | 'review'>('select');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyTier | null>(null);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    setGameState(loadState());
  }, []);

  useEffect(() => {
    if (gameState !== defaultState()) {
      saveState(gameState);
    }
  }, [gameState]);

  const fetchChallenge = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/game/daily-challenge');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error fetching challenge');
      }
      const json = await res.json();
      setChallenge(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'daily' && !challenge && !loading) {
      fetchChallenge();
    }
  }, [activeTab, challenge, loading, fetchChallenge]);

  const handleVerify = async (guess: SignalAction, confidence: ConfidenceLevel): Promise<VerifyResponse> => {
    const res = await fetch('/api/game/verify-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userGuess: guess, confidence }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Verification failed');
    }
    const json: VerifyResponse = await res.json();

    const today = new Date().toISOString().split('T')[0];
    setGameState(prev => {
      const newState: GameState = {
        ...prev,
        totalScore: prev.totalScore + json.score,
        streak: json.correct ? prev.streak + 1 : 0,
        bestStreak: json.correct ? Math.max(prev.bestStreak, prev.streak + 1) : prev.bestStreak,
        challengesCompleted: prev.challengesCompleted + 1,
        challengesCorrect: prev.challengesCorrect + (json.correct ? 1 : 0),
        todayCompleted: true,
        lastChallengeDate: today,
        history: [{ date: today, symbol: challenge?.symbol || '', correct: json.correct, score: json.score }, ...prev.history].slice(0, 50),
      };
      newState.level = getLevelFromScore(newState.totalScore);
      newState.achievements = checkAchievements(newState);
      return newState;
    });
    return json;
  };

  const handleRefresh = () => {
    setChallenge(null);
    fetchChallenge();
  };

  const handleSessionComplete = (result: SessionResult) => {
    const now = new Date().toISOString().split('T')[0];
    setGameState(prev => {
      const newState: GameState = {
        ...prev,
        totalScore: prev.totalScore + result.totalScore,
        streak: result.correct > 0 ? result.correct : 0,
        bestStreak: Math.max(prev.bestStreak, result.bestStreak),
        challengesCompleted: prev.challengesCompleted + result.total,
        challengesCorrect: prev.challengesCorrect + result.correct,
        sessionsCompleted: prev.sessionsCompleted + 1,
        totalTimePlayed: prev.totalTimePlayed + result.averageTime * result.total,
        history: [
          ...result.results.map(r => ({
            date: now,
            symbol: r.symbol,
            correct: r.correct,
            score: r.score,
          })),
          ...prev.history,
        ].slice(0, 50),
      };
      newState.level = getLevelFromScore(newState.totalScore);
      newState.achievements = checkAchievements(newState);
      return newState;
    });
    setSessionResult(result);
    setSessionView('review');
  };

  const difficultyLevel = gameState.level;
  const levelThresholds = [0, 400, 900, 1500, 2200, 3000, 4000, 5200, 6600, 8200, 10000, 13000, 16000, 20000, 25000, 30000, 40000];
  const nextLevelScore = levelThresholds[Math.min(difficultyLevel, levelThresholds.length - 1)] || 0;
  const scoreToNext = nextLevelScore - gameState.totalScore;

  const TABS = [
    { id: 'daily' as const, icon: '🎯', label: 'Reto Diario' },
    { id: 'session' as const, icon: '🎮', label: 'Sesión' },
    { id: 'practice' as const, icon: '📝', label: 'Práctica' },
    { id: 'progress' as const, icon: '📈', label: 'Progreso' },
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ color: C.textPrimary, margin: '0 0 2px', fontSize: '22px' }}>
            🎮 Trading Trainer
          </h2>
          <p style={{ color: C.textSecondary, fontSize: '13px', margin: 0 }}>
            Nivel {difficultyLevel} · {gameState.totalScore.toLocaleString()} pts
            {scoreToNext > 0 && ` · ${scoreToNext} pts al siguiente nivel`}
          </p>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: R.md,
          background: `linear-gradient(135deg, ${C.positive20}, ${C.positive08})`,
          border: `1px solid ${C.positive30}`,
          fontSize: '12px', fontWeight: 600, color: C.positive,
        }}>
          Racha: {gameState.streak}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'session') setSessionView('select');
            }}
            style={{
              padding: '10px 18px', borderRadius: R.lg, border: 'none',
              background: activeTab === tab.id ? C.gradientPrimary : C.bgCard,
              color: activeTab === tab.id ? '#fff' : C.textSecondary,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'all 0.15s', border: activeTab === tab.id ? 'none' : `1px solid ${C.borderLight}`,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Daily Challenge */}
      {activeTab === 'daily' && (
        <>
          {loading && (
            <ThinkingOrbLoader state="solving" size={64} label="Preparando tu reto del día..." />
          )}
          {error && (
            <div style={{ background: `${C.negative18}`, color: C.negative, padding: '16px', borderRadius: R.lg, textAlign: 'center', marginBottom: '16px' }}>
              {error}
              <button onClick={fetchChallenge} style={{
                display: 'block', margin: '12px auto 0', padding: '8px 16px',
                borderRadius: R.md, border: `1px solid ${C.negative}`, background: 'transparent',
                color: C.negative, cursor: 'pointer', fontSize: '13px',
              }}>
                Reintentar
              </button>
            </div>
          )}
          {!loading && !error && !challenge && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.textSecondary }}>
              No hay reto disponible. Intenta de nuevo.
            </div>
          )}
          {challenge && !loading && (
            <ChallengeCard
              challenge={challenge}
              onVerify={handleVerify}
              onRefresh={handleRefresh}
            />
          )}
        </>
      )}

      {/* Session */}
      {activeTab === 'session' && sessionView === 'select' && (
        <div>
          <p style={{ color: C.textSecondary, fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
            Elige la dificultad. Cada nivel desbloquea modos más desafiantes.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DIFFICULTIES.map(diff => {
              const locked = difficultyLevel < diff.minLevel;
              const icon = diff.icon;
              return (
                <button key={diff.id}
                  onClick={() => {
                    if (locked) return;
                    setSelectedDifficulty(diff.id);
                    setSessionView('playing');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '16px 20px', borderRadius: R.xl,
                    background: locked ? `C.bgBase80` : C.bgCard,
                    border: locked
                      ? `1px solid ${C.borderLight}`
                      : `1px solid ${TIER_COLORS[diff.id]}30`,
                    cursor: locked ? 'not-allowed' : 'pointer',
                    textAlign: 'left', width: '100%',
                    transition: 'all 0.2s',
                    opacity: locked ? 0.5 : 1,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {!locked && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                      background: TIER_COLORS[diff.id],
                    }} />
                  )}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: R.lg,
                    background: locked ? C.bgBase : `${TIER_COLORS[diff.id]}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0,
                    border: locked ? `1px solid ${C.border}` : `1px solid ${TIER_COLORS[diff.id]}30`,
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: '15px' }}>
                        {diff.name}
                      </span>
                      {locked && (
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: R.sm,
                          background: `${C.negative18}`, color: C.negative, fontWeight: 600,
                        }}>
                          Nivel {diff.minLevel}+
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: C.textMuted, fontSize: '12px', lineHeight: '1.4' }}>
                      {diff.desc}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: C.textMuted }}>📊 {diff.challenges} retos</span>
                      <span style={{ fontSize: '10px', color: C.textMuted }}>💡 {diff.hints}</span>
                      <span style={{ fontSize: '10px', color: C.textMuted }}>⏱ {diff.timer}</span>
                    </div>
                  </div>
                  {!locked && (
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: TIER_COLORS[diff.id] + '20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ color: TIER_COLORS[diff.id], fontSize: '14px' }}>→</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'session' && sessionView === 'playing' && selectedDifficulty && (
        <GameSession
          difficulty={selectedDifficulty}
          onComplete={handleSessionComplete}
          onCancel={() => setSessionView('select')}
          level={difficultyLevel}
        />
      )}

      {activeTab === 'session' && sessionView === 'review' && sessionResult && (
        <SessionReview
          result={sessionResult}
          onNewSession={() => {
            setSessionView('select');
            setSessionResult(null);
            setSelectedDifficulty(null);
          }}
          onBack={() => {
            setSessionView('select');
            setSessionResult(null);
            setSelectedDifficulty(null);
          }}
        />
      )}

      {/* Practice */}
      {activeTab === 'practice' && <FreePractice />}

      {/* Progress */}
      {activeTab === 'progress' && <GameProgress state={gameState} />}
    </div>
  );
}
