import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { theme } from '../constants/theme';
import { MascotBubble } from '../components/MascotBubble';
import { QUIZ_QUESTIONS } from '../data/quizQuestions';
import { MISSIONS } from '../data/missions';
import { hapticsSelection, hapticsSuccess, hapticsError } from '../utils/haptics';

type Tab = 'quiz' | 'misiones';

function findNextQuestion(quizAnswered: Record<string, boolean>, afterId?: string) {
  const start = afterId ? QUIZ_QUESTIONS.findIndex(q => q.id === afterId) + 1 : 0;
  for (let i = start; i < QUIZ_QUESTIONS.length; i++) {
    if (!quizAnswered[QUIZ_QUESTIONS[i].id]) return QUIZ_QUESTIONS[i];
  }
  for (let i = 0; i < start; i++) {
    if (!quizAnswered[QUIZ_QUESTIONS[i].id]) return QUIZ_QUESTIONS[i];
  }
  return null;
}

export function AprendeScreen() {
  const [tab, setTab] = useState<Tab>('quiz');
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const { quizAnswered, answerQuiz } = useGameStore();
  const completedMissions = useGameStore(s => s.completedMissions);

  const [question, setQuestion] = useState(() => findNextQuestion(quizAnswered));

  const remaining = QUIZ_QUESTIONS.filter(q => !quizAnswered[q.id]).length;

  const handleAnswer = (idx: number) => {
    if (selected !== null || !question) return;
    setSelected(idx);
    hapticsSelection();
    if (idx === question.correctIndex) {
      hapticsSuccess();
      setScore(s => s + 1);
      answerQuiz(question.id, true);
      useUIStore.getState().setToast('✅ ¡Correcto! +10 XP', 'success');
    } else {
      hapticsError();
      answerQuiz(question.id, false);
      useUIStore.getState().setToast(`❌ Incorrecto. La respuesta era: ${question.options[question.correctIndex]}`, 'error');
    }
  };

  const nextQuestion = useCallback(() => {
    setSelected(null);
    const next = findNextQuestion(useGameStore.getState().quizAnswered, question?.id);
    setQuestion(next);
  }, [question?.id]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected !== null && remaining > 0) {
      timerRef.current = setTimeout(nextQuestion, 2000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [selected, remaining, nextQuestion]);

  if (!question) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <MascotBubble size="small" messages={['¿Listo para aprender? 🧠']} />
        <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>¡Completaste todas!</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>Vuelve pronto para más preguntas</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <MascotBubble size="small" messages={['¿Listo para aprender? 🧠', 'El conocimiento es poder en el mercado 📚', 'Cada pregunta te hace más inteligente 🎓']} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['quiz', 'misiones'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => { setTab(t); hapticsSelection(); }}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 12,
              backgroundColor: tab === t ? theme.primary : theme.surface, alignItems: 'center',
            }}
          >
            <Text style={{ color: tab === t ? '#fff' : theme.text, fontWeight: '700', fontSize: 15 }}>
              {t === 'quiz' ? '📝 Quiz' : '🎪 Misiones'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'quiz' ? (
        <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 18 }}>{question.difficulty === 'facil' ? '🟢' : question.difficulty === 'intermedio' ? '🟡' : '🔴'}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, textTransform: 'capitalize' }}>{question.difficulty}</Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Restantes: {remaining}</Text>
          </View>

          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', lineHeight: 26 }}>{question.question}</Text>

          {question.options.map((opt, i) => {
            let bg = theme.surface;
            let border = `${theme.textSecondary}30`;
            if (selected !== null) {
              if (i === question.correctIndex) { bg = `${theme.gain}20`; border = theme.gain; }
              else if (i === selected && i !== question.correctIndex) { bg = `${theme.loss}20`; border = theme.loss; }
            }
            return (
              <TouchableOpacity
                key={i}
                onPress={() => handleAnswer(i)}
                disabled={selected !== null}
                style={{
                  padding: 14, borderRadius: 12, borderWidth: 1.5,
                  backgroundColor: bg, borderColor: border,
                  opacity: selected !== null && i !== selected && i !== question.correctIndex ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>{opt}</Text>
              </TouchableOpacity>
            );
          })}

          {selected !== null && (
            <View style={{ backgroundColor: `${theme.primary}15`, padding: 14, borderRadius: 12 }}>
              <Text style={{ color: theme.primary, fontSize: 14, lineHeight: 20 }}>{question.explanation}</Text>
            </View>
          )}

          {selected !== null && remaining > 0 && (
            <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center' }}>Próxima pregunta en un momento...</Text>
          )}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {MISSIONS.filter(m => !completedMissions.includes(m.id)).map(m => (
            <TouchableOpacity
              key={m.id}
              style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Text style={{ fontSize: 36 }}>{m.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{m.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>{m.description}</Text>
                <Text style={{ color: theme.primary, fontSize: 12, marginTop: 4 }}>📖 {m.conceptLearned}</Text>
              </View>
              <Text style={{ fontSize: 24 }}>→</Text>
            </TouchableOpacity>
          ))}
          {MISSIONS.every(m => completedMissions.includes(m.id)) && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 48 }}>🏆</Text>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>¡Todas las misiones completadas!</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>Eres un verdadero alumno de Bull Buddy.</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
