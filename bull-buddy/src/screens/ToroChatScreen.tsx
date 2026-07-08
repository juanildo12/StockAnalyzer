import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { sendChatMessage, type ChatMessage } from '../services/chatService';
import { useGameStore } from '../store/gameStore';
import { checkAchievements } from '../utils/achievements';
import { useUIStore } from '../store/uiStore';

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy Toro 🐂, tu compañero de Bull Buddy. Pregúntame lo que quieras sobre el juego, las acciones de MOONCO, o cómo mejorar en el simulador. ¡Estoy aquí para ayudarte! 🚀',
};

const QUICK_ACTIONS = [
  '¿Por qué sube y baja MOONCO?',
  '¿Qué significa una vela verde?',
  'Dame un tip para el quiz',
  '¿Cómo funciona la racha?',
];

export default function ToroChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { level, coins, cash, shares, trades, incrementChatCount } = useGameStore();
  const { addToast } = useUIStore();

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    incrementChatCount();
    const newAchs = checkAchievements();
    newAchs.forEach(a => {
      addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward });
    });

    setIsLoading(true);
    try {
      const response = await sendChatMessage(
        [...messages, userMsg],
        { level, coins, cash, shares, recentTrades: trades.length }
      );
      const botMsg: ChatMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      const fallback: ChatMessage = { role: 'assistant', content: '¡Muu! Hubo un problema, ¿puedes intentarlo de nuevo? 🐂' };
      setMessages(prev => [...prev, fallback]);
    }
    setIsLoading(false);
  }, [inputText, isLoading, messages, level, coins, cash, shares, trades.length, incrementChatCount]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* Quick actions */}
        {messages.length === 1 && (
          <View style={styles.quickActions}>
            <Text style={styles.quickTitle}>Preguntas rápidas</Text>
            <View style={styles.quickChips}>
              {QUICK_ACTIONS.map((q, i) => (
                <Pressable key={i} onPress={() => { setInputText(q); }}
                  style={styles.quickChip}>
                  <Text style={styles.quickChipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
              {item.role === 'assistant' && <Text style={styles.botIcon}>🐂</Text>}
              <Text style={[styles.bubbleText, item.role === 'user' && { color: colors.white }]}>
                {item.content}
              </Text>
            </View>
          )}
          ListFooterComponent={isLoading ? (
            <View style={styles.typing}>
              <Text style={styles.botIcon}>🐂</Text>
              <Text style={styles.typingText}>Toro está escribiendo...</Text>
            </View>
          ) : null}
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={300}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable onPress={handleSend} disabled={!inputText.trim() || isLoading}
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && { opacity: 0.4 }]}>
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  messagesList: { padding: 16, paddingBottom: 8, gap: 12 },
  bubble: {
    flexDirection: 'row', gap: 8, padding: 14, borderRadius: radius.xl,
    maxWidth: '85%', ...shadows.card,
  },
  userBubble: {
    backgroundColor: colors.purple, alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: colors.bgCard, alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  botIcon: { fontSize: 22 },
  bubbleText: { flex: 1, fontSize: fonts.sizes.md, color: colors.text, lineHeight: 22 },
  typing: {
    flexDirection: 'row', gap: 8, padding: 14, alignItems: 'center',
  },
  typingText: { fontSize: fonts.sizes.sm, color: colors.textMuted, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  input: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: fonts.sizes.md, color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.purple, width: 40, height: 40,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  quickActions: { padding: 16, paddingBottom: 8, gap: 10 },
  quickTitle: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.textMuted },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    backgroundColor: colors.bgCard, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.purple,
  },
  quickChipText: { fontSize: fonts.sizes.sm, color: colors.purple, fontWeight: '600' },
});
