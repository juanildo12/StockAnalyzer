'use client';

import type { GameState, DifficultyTier } from '@/src/types';
import { colors as C, radius as R } from '@/src/utils/webTheme';

interface Props {
  state: GameState;
}

const LEVELS: { name: string; icon: string; minScore: number; minStreak: number; tier: DifficultyTier }[] = [
  { name: 'Novato', icon: '🌱', minScore: 0, minStreak: 0, tier: 'novato' },
  { name: 'Bronce', icon: '🥉', minScore: 400, minStreak: 2, tier: 'bronce' },
  { name: 'Bronce II', icon: '🥉', minScore: 900, minStreak: 3, tier: 'bronce' },
  { name: 'Bronce III', icon: '🥉', minScore: 1500, minStreak: 4, tier: 'bronce' },
  { name: 'Plata', icon: '🥈', minScore: 2200, minStreak: 4, tier: 'plata' },
  { name: 'Plata II', icon: '🥈', minScore: 3000, minStreak: 5, tier: 'plata' },
  { name: 'Plata III', icon: '🥈', minScore: 4000, minStreak: 6, tier: 'plata' },
  { name: 'Oro', icon: '🥇', minScore: 5200, minStreak: 6, tier: 'oro' },
  { name: 'Oro II', icon: '🥇', minScore: 6600, minStreak: 7, tier: 'oro' },
  { name: 'Oro III', icon: '🥇', minScore: 8200, minStreak: 8, tier: 'oro' },
  { name: 'Platino', icon: '💎', minScore: 10000, minStreak: 8, tier: 'platino' },
  { name: 'Platino II', icon: '💎', minScore: 13000, minStreak: 10, tier: 'platino' },
  { name: 'Platino III', icon: '💎', minScore: 16000, minStreak: 12, tier: 'platino' },
  { name: 'Diamante', icon: '👑', minScore: 20000, minStreak: 12, tier: 'diamante' },
  { name: 'Diamante II', icon: '👑', minScore: 25000, minStreak: 15, tier: 'diamante' },
  { name: 'Diamante III', icon: '👑', minScore: 30000, minStreak: 18, tier: 'diamante' },
  { name: 'Leyenda', icon: '⭐', minScore: 40000, minStreak: 20, tier: 'diamante' },
];

const TIER_LABELS: Record<DifficultyTier, string> = {
  novato: 'Principiante', bronce: 'Básico', plata: 'Intermedio',
  oro: 'Avanzado', platino: 'Experto', diamante: 'Élite',
};

const TIER_COLORS: Record<DifficultyTier, string> = {
  novato: '#22C55E', bronce: '#CD7F32', plata: '#94A3B8',
  oro: '#F59E0B', platino: '#06B6D4', diamante: '#8B5CF6',
};

function getLevel(score: number, streak: number): { name: string; icon: string; current: number; max: number; levelNum: number; tier: DifficultyTier } {
  let currentIdx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].minScore && streak >= LEVELS[i].minStreak) {
      currentIdx = i;
      break;
    }
  }
  const current = LEVELS[currentIdx];
  const next = LEVELS[Math.min(currentIdx + 1, LEVELS.length - 1)];
  const scoreProgress = next.minScore - current.minScore > 0
    ? Math.min(100, ((score - current.minScore) / (next.minScore - current.minScore)) * 100)
    : 100;
  return {
    name: current.name, icon: current.icon, current: Math.round(scoreProgress), max: 100,
    levelNum: currentIdx + 1, tier: current.tier,
  };
}

function getNextUnlock(level: number): { name: string; description: string; icon: string } | null {
  const unlocks: Record<number, { name: string; description: string; icon: string }> = {
    2: { name: 'Bronce', description: 'Desbloquea sesiones de trading (5 retos)', icon: '🎮' },
    5: { name: 'Plata', description: 'Timer activado (+75s por reto)', icon: '⏱️' },
    8: { name: 'Oro', description: 'Sin pistas iniciales. Confía en tu análisis', icon: '🧠' },
    11: { name: 'Platino', description: 'Acciones volátiles + Timer 35s', icon: '⚡' },
    14: { name: 'Diamante', description: 'Acciones complejas + Timer 20s', icon: '👑' },
  };
  for (let i = level + 1; i <= 16; i++) {
    if (unlocks[i]) return { ...unlocks[i], name: `Nivel ${i}: ${unlocks[i].name}` };
  }
  return null;
}

export default function GameProgress({ state }: Props) {
  const level = getLevel(state.totalScore, state.streak);
  const accuracy = state.challengesCompleted > 0
    ? Math.round((state.challengesCorrect / state.challengesCompleted) * 100)
    : 0;
  const nextUnlock = getNextUnlock(level.levelNum);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Level card */}
      <div style={{
        background: `linear-gradient(135deg, ${C.bgCard}, ${TIER_COLORS[level.tier]}08)`,
        borderRadius: R.xl, padding: '24px', marginBottom: '16px',
        border: `1px solid ${TIER_COLORS[level.tier]}20`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: TIER_COLORS[level.tier] + '25',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px',
            border: `2px solid ${TIER_COLORS[level.tier]}40`,
          }}>
            {level.icon}
          </div>
          <div>
            <p style={{ margin: 0, color: C.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nivel {level.levelNum} • {level.name}
            </p>
            <p style={{ margin: '4px 0 0', color: C.textPrimary, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {state.totalScore.toLocaleString()} pts
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: TIER_COLORS[level.tier], fontWeight: 600 }}>
              {TIER_LABELS[level.tier]}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: C.textMuted, fontSize: '11px' }}>Progreso</span>
            <span style={{ color: C.accent, fontSize: '11px', fontWeight: 600 }}>{level.current}%</span>
          </div>
          <div style={{ height: '6px', background: C.bgBase, borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${level.current}%`, height: '100%',
              background: `linear-gradient(90deg, ${TIER_COLORS[level.tier]}, ${C.accent})`,
              borderRadius: '3px', transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {nextUnlock && (
          <div style={{
            marginTop: '12px', padding: '10px 14px', background: C.bgBase,
            borderRadius: R.md, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '18px' }}>{nextUnlock.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: C.textSecondary }}>
                Próximo desbloqueo:
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: C.textPrimary, fontWeight: 600 }}>
                {nextUnlock.name}: {nextUnlock.description}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{
        background: C.bgCard, borderRadius: R.xl, padding: '20px', marginBottom: '16px',
        border: `1px solid ${C.borderLight}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            { label: 'Racha', value: `${state.streak}`, sub: `mejor: ${state.bestStreak}`, color: '#F59E0B' },
            { label: 'Precisión', value: `${accuracy}%`, sub: `${state.challengesCorrect}/${state.challengesCompleted}`, color: '#22C55E' },
            { label: 'Retos', value: `${state.challengesCompleted}`, sub: 'completados', color: '#6366F1' },
            { label: 'Sesiones', value: `${state.sessionsCompleted}`, sub: 'completadas', color: '#06B6D4' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: C.bgBase, borderRadius: R.md, padding: '12px', textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: stat.color }}>
                {stat.value}
              </p>
              <p style={{ margin: 0, fontSize: '10px', color: C.textMuted }}>{stat.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: '9px', color: C.textMuted, opacity: 0.6 }}>{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      {state.achievements.length > 0 && (
        <div style={{
          background: C.bgCard, borderRadius: R.xl, padding: '20px', marginBottom: '16px',
          border: `1px solid ${C.borderLight}`,
        }}>
          <p style={{ fontSize: '12px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            Logros desbloqueados ({state.achievements.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {state.achievements.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', background: `${C.accent}15`, borderRadius: R.md,
                fontSize: '12px', color: C.textPrimary, border: `1px solid ${C.accent}20`,
              }}>
                <span>{a.icon}</span>
                <span style={{ fontWeight: 500 }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {state.history.length > 0 && (
        <div style={{
          background: C.bgCard, borderRadius: R.xl, padding: '20px', marginBottom: '16px',
          border: `1px solid ${C.borderLight}`,
        }}>
          <p style={{ fontSize: '12px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            Historial reciente
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {state.history.slice(0, 20).map((h, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', background: C.bgBase, borderRadius: R.sm,
                fontSize: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{h.correct ? '✅' : '❌'}</span>
                  <span style={{ color: C.textPrimary, fontWeight: 600 }}>{h.symbol}</span>
                  <span style={{ color: C.textMuted, fontSize: '10px' }}>{h.date}</span>
                </div>
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>+{h.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
