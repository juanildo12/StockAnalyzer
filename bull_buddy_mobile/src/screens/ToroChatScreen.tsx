import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { theme } from '../constants/theme';
import { hapticsSelection } from '../utils/haptics';

interface ChatMessage {
  id: string;
  from: 'user' | 'toro';
  text: string;
}

const RESPONSES: Record<string, string[]> = {
  hola: ['¡Hola! 🐂 ¿Listo para conquistar el mercado?', '¡Buenas, trader! ¿En qué te ayudo?'],
  que: ['Soy tu guía en el mundo del trading. Aprende, practica y gana.', '¡Soy Bull Buddy! Tu mentor financiero con cuernos.'],
  como: ['Genial! Acabo de revisar tus stats y vas muy bien. Sigue así.', '¡De maravilla! El mercado está lleno de oportunidades.'],
  trading: ['El trading es comprar y vender activos para obtener ganancias. Practica en el simulador.', 'Recuerda: gestionar el riesgo es más importante que ganar dinero.'],
  comprar: ['¡Buena decisión! Recuerda diversificar. No pongas todo en una sola acción.', 'Compra cuando veas oportunidad, pero siempre con un plan.'],
  vender: ['Vender en el momento correcto es un arte. Si tienes ganancias, considera tomar al menos parte.', 'No tengas miedo de vender. Las pérdidas pequeñas son mejores que las grandes.'],
  riesgo: ['El riesgo es parte del juego. Nunca inviertas más de lo que estés dispuesto a perder.', 'Usa stop losses y diversifica. Esa es la clave.'],
  gracias: ['¡De nada! 🐂 Recuerda: la educación financiera es el mejor investmento.', '¡Para eso estoy! Vuelve cuando quieras.'],
};

const FALLBACK = [
  'Interesante... cuéntame más. 🤔',
  '¡Buen punto! ¿Has probado el simulador de trading?',
  'No estoy seguro de entender. ¿Quieres hacer trading o aprender algo nuevo?',
  '¡Muy bien! Recuerda que puedes practicar en el simulador sin arriesgar dinero real.',
  'El toro siempre está aquí para ayudar. ¿Qué más quieres saber?',
  'Buena pregunta! Prueba el quiz para aprender más sobre ese tema.',
];

function getResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [keyword, responses] of Object.entries(RESPONSES)) {
    if (lower.includes(keyword)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}

const WELCOME: ChatMessage = { id: 'welcome', from: 'toro', text: '¡Hola! Soy el Toro de Bull Buddy 🐂. Pregúntame lo que quieras sobre trading, inversiones o el simulador.' };

export function ToroChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    hapticsSelection();
    const userMsg: ChatMessage = { id: Date.now().toString(), from: 'user', text };
    const responseText = getResponse(text);
    const toroMsg: ChatMessage = { id: (Date.now() + 1).toString(), from: 'toro', text: responseText };
    setMessages(prev => [...prev, userMsg, toroMsg]);
    setInput('');

    useGameStore.getState().addXP(5);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatRef}
        data={messages}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: item.from === 'user' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 28 }}>{item.from === 'toro' ? '🐂' : '🧑'}</Text>
            <View
              style={{
                maxWidth: '75%',
                padding: 12, borderRadius: 16,
                borderBottomRightRadius: item.from === 'user' ? 4 : 16,
                borderBottomLeftRadius: item.from === 'toro' ? 4 : 16,
                backgroundColor: item.from === 'user' ? theme.primary : theme.surface,
              }}
            >
              <Text style={{ color: item.from === 'user' ? '#fff' : theme.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
            </View>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.surface }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={theme.textSecondary}
          style={{
            flex: 1, backgroundColor: theme.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
            color: theme.text, fontSize: 15,
          }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={{ backgroundColor: theme.primary, width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 20 }}>➡️</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
