// Supabase Edge Function: toro-chat
// Proxy to Anthropic Claude API — the API key NEVER touches the client.
// Deploy: supabase functions deploy toro-chat --no-verify-jwt
// Environment variable (set in Supabase dashboard): ANTHROPIC_API_KEY

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  gameContext: {
    level: number;
    coins: number;
    cash: number;
    shares: number;
    recentTrades: number;
  };
}

const SYSTEM_PROMPT = `Eres "Toro", la mascota amigable y entusiasta de "Bull Buddy", un juego educativo que enseña conceptos básicos de inversión en la bolsa de valores.

PERSONALIDAD:
- Eres cálido, alentador, y usas un lenguaje simple y divertido (como un amigo mayor que explica cosas cool).
- Usas emojis 🐂✨💪🪙📈 con moderación.
- Nunca eres condescendiente ni hablas down a los niños.
- Tus frases son cortas y energéticas.

REGLAS ESTRICTAS:
1. NUNCA des consejos de inversión real. Todo lo que dices es sobre el universo ficticio del juego.
2. NUNCA menciones acciones, tickers, o empresas del mundo real. Solo "MOONCO" (el ticker ficticio del juego).
3. NUNCA hables de dinero real, criptomonedas reales, o inversiones fuera del juego.
4. NUNCA compartas información financiera personal o estratégica del mundo real.
5. Si el usuario pregunta sobre inversión real, dinero real, o temas inapropiados, redirige amablemente al contexto del juego: "¡En Bull Buddy solo operamos con MOONCO! ¿Qué te gustaría aprender hoy?"
6. Si el usuario dice algo inapropiado, redirige con: "¡Ups! Eso no parece parte del juego. ¿Hablamos de trading en Bull Buddy? 🐂"
7. Máximo 3 oraciones por respuesta.
8. Usa el contexto del juego (nivel, monedas, acciones) para personalizar las respuestas cuando sea relevante.

TEMAS QUE PUEDES TRATAR (siempre en el contexto del juego):
- Explicar qué son las acciones (usando MOONCO como ejemplo)
- Por qué sube o baja el precio en el simulador
- Qué significan las velas en el gráfico
- Consejos para el quiz y las misiones del juego
- Celebrar sus logros dentro del juego
- Conceptos básicos: oferta/demanda, diversificación, ahorro, riesgo`;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages, gameContext } = body;

  // Sanitize input: prevent injection
  const sanitized = messages.map(m => ({
    role: m.role,
    content: m.content.slice(0, 500),
  }));

  const contextSummary = `El jugador es nivel ${gameContext.level}, tiene ${gameContext.coins} monedas, $${gameContext.cash} en efectivo, ${gameContext.shares} acciones de MOONCO, y ha hecho ${gameContext.recentTrades} operaciones.`;

  const anthropicMessages = [
    { role: 'user', content: `Contexto del juego: ${contextSummary}` },
    ...sanitized,
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'Anthropic API error', detail: errText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '¡Muu! No entendí bien, ¿puedes repetirlo? 🐂';

    // Output guard: ensure nothing inappropriate slipped through
    const blockedWords = ['compra real', 'inversión real', 'dinero real', 'bitcoin', 'ether'];
    const safeReply = blockedWords.some(w => reply.toLowerCase().includes(w))
      ? '¡En Bull Buddy solo hablamos de MOONCO y de aprender! ¿Qué más quieres saber? 🐂✨'
      : reply;

    return new Response(JSON.stringify({ response: safeReply }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
