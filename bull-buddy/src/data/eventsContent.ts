import type { GameState } from '../types';

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  bannerEmoji: string;
  bannerColor: string;
  startsAt: string;
  endsAt: string;
  rewardCoins: number;
  rewardXp: number;
  rewardSkin: string | null;
  missions: EventMission[];
}

export interface EventMission {
  id: string;
  description: string;
  condition: (state: GameState) => boolean;
  progress: (state: GameState) => number;
  max: number;
  rewardCoins: number;
  rewardXp: number;
}

function now() {
  return new Date().toISOString();
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

export const MOCK_EVENTS: GameEvent[] = [
  {
    id: 'toro-alcista',
    title: 'Semana del Toro Alcista 🐂',
    description: '¡El Toro está de buenas! Gana el doble de XP en todas las actividades durante esta semana.',
    bannerEmoji: '🐂',
    bannerColor: '#3FD6A0',
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(6),
    rewardCoins: 0,
    rewardXp: 0,
    rewardSkin: null,
    missions: [
      {
        id: 'event-buy-5',
        description: 'Compra 5 acciones de MOONCO',
        condition: (s: GameState) => s.totalBuys >= 5,
        progress: (s: GameState) => Math.min(1, s.totalBuys / 5),
        max: 5,
        rewardCoins: 50,
        rewardXp: 100,
      },
      {
        id: 'event-quiz-3',
        description: 'Completa 3 quizzes de cualquier nivel',
        condition: (s: GameState) => s.completedQuizIds.length >= 3,
        progress: (s: GameState) => Math.min(1, s.completedQuizIds.length / 3),
        max: 3,
        rewardCoins: 30,
        rewardXp: 75,
      },
    ],
  },
  {
    id: 'skin-halloween',
    title: 'Colección Halloween 🎃',
    description: 'Consigue el skin exclusivo de Toro Fantasma completando las misiones especiales.',
    bannerEmoji: '🎃',
    bannerColor: '#FF6B6B',
    startsAt: daysFromNow(10),
    endsAt: daysFromNow(24),
    rewardCoins: 0,
    rewardXp: 0,
    rewardSkin: 'fantasma',
    missions: [
      {
        id: 'event-win-3',
        description: 'Gana 3 operaciones en el simulador',
        condition: (s: GameState) => true,
        progress: (s: GameState) => 0,
        max: 3,
        rewardCoins: 100,
        rewardXp: 200,
      },
    ],
  },
];
