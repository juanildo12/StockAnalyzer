import type { QuizDifficulty, QuizResult, TradeResult } from '../types';

export interface DifficultyProfile {
  skillScore: number;
  recommendedDifficulty: QuizDifficulty;
  volatilityMultiplier: number;
  label: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateSkillScore(
  quizResults: QuizResult[],
  tradeResults: TradeResult[]
): number {
  if (quizResults.length === 0 && tradeResults.length === 0) return 0;

  let score = 0;
  let weight = 0;

  const recent = [...quizResults, ...tradeResults].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  for (const r of recent) {
    const w = recent.length - recent.indexOf(r);
    if ('difficulty' in r) {
      const diffWeight = r.difficulty === 'facil' ? 0.5 : r.difficulty === 'intermedio' ? 1 : 1.5;
      score += (r.correct ? diffWeight : -diffWeight) * w;
    } else {
      score += (r.profitable ? 1 : -1) * w;
    }
    weight += w;
  }

  return weight > 0 ? clamp(score / weight, -1, 1) : 0;
}

export function getRecommendedDifficulty(score: number): QuizDifficulty {
  if (score < -0.3) return 'facil';
  if (score < 0.3) return 'intermedio';
  return 'avanzado';
}

export function getVolatilityMultiplier(score: number): number {
  return 0.4 + (score + 1) * 0.6;
}

export function getDifficultyProfile(
  quizResults: QuizResult[],
  tradeResults: TradeResult[]
): DifficultyProfile {
  const skillScore = calculateSkillScore(quizResults, tradeResults);
  return {
    skillScore,
    recommendedDifficulty: getRecommendedDifficulty(skillScore),
    volatilityMultiplier: getVolatilityMultiplier(skillScore),
    label: skillScore < -0.3 ? 'Principiante' : skillScore < 0.3 ? 'Intermedio' : 'Avanzado',
  };
}
