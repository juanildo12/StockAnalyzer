import { supabase } from './supabase';
import { useGameStore } from '../store/gameStore';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MOCK_RESPONSES = [
  '¡Muuuy buena pregunta! 🐂 En el juego, cuando ves una vela verde significa que el precio de MOONCO subió en ese período. ¿Quieres saber más sobre cómo leer el gráfico?',
  '¡Claro! Tu portafolio tiene acciones de MOONCO que compraste en el simulador. Entre más acciones tengas y más suba el precio, más valdrá tu portafolio. 📈',
  'El precio de MOONCO cambia porque en el juego simulamos oferta y demanda. Cuando muchos jugadores "compran", sube. Cuando "venden", baja. ¡Así funciona el mercado real! 🪙',
  '¡Vas muy bien! Sigue así y pronto podrás comprar skins nuevos para mí en la tienda. ¿Has visto el de unicornio? 🦄 ¡Es mi favorito!',
  'Las misiones son aventuras donde aprendes conceptos financieros tomando decisiones. Cada elección afecta tus monedas y XP. ¡Elige sabiamente! 🍋',
  '¿Sabías que diversificar significa no invertir todo en una sola acción? En Bull Buddy solo tenemos MOONCO, pero en la vida real es mejor repartir el riesgo. 📊',
  '¡Sigue practicando en el quiz! Entre más aciertos seguidos, más grande es tu combo y más monedas ganas. ¡Intenta llegar a x5! 🔥',
  'Tu racha diaria te da monedas y XP cada día que entras. ¡No rompas la racha! Si reclutas 7 días seguidos, las recompensas son enormes. 📅',
];

let mockIdx = 0;

async function getMockResponse(userMessage: string): Promise<string> {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
  const response = MOCK_RESPONSES[mockIdx % MOCK_RESPONSES.length];
  mockIdx++;
  return response;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  gameContext?: { level: number; coins: number; cash: number; shares: number; recentTrades: number }
): Promise<string> {
  const { level, coins, cash, shares, trades } = useGameStore.getState();
  const ctx = gameContext || {
    level, coins, cash, shares,
    recentTrades: trades.length,
  };

  try {
    const { data, error } = await supabase.functions.invoke('toro-chat', {
      body: { messages, gameContext: ctx },
    });

    if (error) throw error;
    if (!data?.response) throw new Error('Respuesta vacía');
    return data.response;
  } catch {
    return getMockResponse(messages[messages.length - 1]?.content || '');
  }
}
