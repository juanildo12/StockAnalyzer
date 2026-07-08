import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import MascotBubble from '../components/MascotBubble';
import HeaderActions from '../components/HeaderActions';
import { QUIZ_QUESTIONS } from '../data/quizQuestions';
import { hapticsSuccess, hapticsError, hapticsLight } from '../utils/haptics';
import { playCorrect, playWrong, playLevelUp } from '../services/soundManager';
import { checkAchievements } from '../utils/achievements';
import { useUIStore } from '../store/uiStore';
import type { QuizDifficulty, MascotMood } from '../types';

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

const COMBO_COLORS = ['', colors.green, colors.yellow, colors.coral, colors.purple, colors.blue];

function ComboBadge({ combo }: { combo: number }) {
  return (
    <View style={[styles.comboBadge, { backgroundColor: COMBO_COLORS[Math.min(combo, COMBO_COLORS.length - 1)] }]}>
      <Text style={styles.comboEmoji}>🔥</Text>
      <Text style={styles.comboText}>x{combo}</Text>
    </View>
  );
}

function OptionButton({
  text, index, correctIndex, selectedAnswer, answered, onPress,
}: {
  text: string; index: number; correctIndex: number; selectedAnswer: number | null;
  answered: boolean; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (answered) {
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [answered]);

  let bgColor = colors.bgCard;
  let borderColor = colors.border;
  let textColor = colors.text;

  if (answered) {
    if (index === correctIndex) {
      bgColor = colors.greenLight;
      borderColor = colors.green;
      textColor = colors.green;
    } else if (index === selectedAnswer && index !== correctIndex) {
      bgColor = colors.coralLight;
      borderColor = colors.coral;
      textColor = colors.coral;
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable onPress={onPress} style={[styles.optionBtn, { backgroundColor: bgColor, borderColor }]} disabled={answered}>
        <View style={[styles.optionRadio,
          answered && index === correctIndex && { backgroundColor: colors.green },
          answered && index === selectedAnswer && index !== correctIndex && { backgroundColor: colors.coral }]}>
          {answered && index === correctIndex && <Ionicons name="checkmark" size={12} color={colors.white} />}
          {answered && index === selectedAnswer && index !== correctIndex && <Ionicons name="close" size={12} color={colors.white} />}
          {!answered && selectedAnswer === index && <View style={styles.radioInner} />}
        </View>
        <Text style={[styles.optionText, { color: textColor }]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Ordered question list: sorted by difficulty so index correlates with complexity
const ORDERED_QUESTIONS = shuffleArray(
  QUIZ_QUESTIONS.filter(q => q.difficulty === 'facil')
).concat(
  shuffleArray(QUIZ_QUESTIONS.filter(q => q.difficulty === 'intermedio'))
).concat(
  shuffleArray(QUIZ_QUESTIONS.filter(q => q.difficulty === 'avanzado'))
);
const TOTAL_QS = ORDERED_QUESTIONS.length;

const DIFF_COLORS: Record<QuizDifficulty, string> = { facil: colors.green, intermedio: colors.yellow, avanzado: colors.coral };
const DIFF_LABELS: Record<QuizDifficulty, string> = { facil: 'Fácil', intermedio: 'Intermedio', avanzado: 'Avanzado' };

function questionLabel(q: typeof QUIZ_QUESTIONS[0]): string {
  return DIFF_LABELS[q.difficulty];
}
function questionColor(q: typeof QUIZ_QUESTIONS[0]): string {
  return DIFF_COLORS[q.difficulty];
}

function pickNear(skillIdx: number, used: Set<string>, completed: Set<string>): typeof QUIZ_QUESTIONS[0] | null {
  const available = ORDERED_QUESTIONS.filter(q => !used.has(q.id) && !completed.has(q.id));
  if (available.length === 0) return null;
  let closest = available[0];
  let bestDist = Infinity;
  for (const q of available) {
    const idx = ORDERED_QUESTIONS.indexOf(q);
    const dist = Math.abs(idx - skillIdx);
    if (dist < bestDist) { bestDist = dist; closest = q; }
  }
  return closest;
}

export default function AprendeScreen() {
  const { completedQuizIds, earnXP, earnCoins, completeQuiz, quizCombo, incrementQuizCombo, resetQuizCombo, addQuizResult } = useGameStore();
  const [sessionActive, setSessionActive] = useState(false);
  const [currentQ, setCurrentQ] = useState<typeof QUIZ_QUESTIONS[0] | null>(null);
  const [skillIdx, setSkillIdx] = useState(0);
  const [questionNum, setQuestionNum] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(true);
  const [score, setScore] = useState(0);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [mascotText, setMascotText] = useState('¡Pon a prueba tus conocimientos!');
  const [mascotMood, setMascotMood] = useState<MascotMood>('feliz');
  const comboPulse = useRef(new Animated.Value(1)).current;
  const { addToast, triggerConfetti } = useUIStore();
  const prevLevel = useRef(useGameStore.getState().level);

  useEffect(() => {
    if (quizCombo >= 2) {
      Animated.sequence([
        Animated.timing(comboPulse, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(comboPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [quizCombo]);

  const startQuiz = useCallback(() => {
    const completed = new Set(completedQuizIds);
    resetQuizCombo();
    let q = pickNear(0, new Set(), completed);
    if (!q) q = ORDERED_QUESTIONS[0];
    setCurrentQ(q);
    setQuestionNum(1);
    setSelectedAnswer(null);
    setAnswered(false);
    setScore(0);
    setSessionActive(true);
    setUsedIds(new Set([q.id]));
    setMascotText(`Pregunta 1 — ${questionLabel(q)}`);
    setMascotMood('emocionado');
  }, [completedQuizIds, resetQuizCombo]);

  const advanceQuestion = useCallback((wasCorrect: boolean, currentSkill: number, used: Set<string>, qNum: number) => {
    const newSkill = Math.max(0, Math.min(TOTAL_QS - 1, currentSkill + (wasCorrect ? 2 : -2)));
    setSkillIdx(newSkill);
    const completed = new Set(completedQuizIds);
    let q = pickNear(newSkill, used, completed);
    if (!q) {
      setUsedIds(new Set());
      q = pickNear(newSkill, new Set(), completed);
    }
    if (!q) {
      setUsedIds(new Set());
      q = pickNear(newSkill, new Set(), new Set());
    }
    if (!q) { setSessionActive(false); return; }
    setCurrentQ(q);
    setQuestionNum(qNum + 1);
    setSelectedAnswer(null);
    setAnswered(false);
    setUsedIds(prev => new Set([...prev, q.id]));
    setMascotText(`Pregunta ${qNum + 1} — ${questionLabel(q)}`);
    setMascotMood('feliz');
  }, [completedQuizIds]);

  const handleAnswer = (idx: number) => {
    if (answered || !currentQ) return;
    setSelectedAnswer(idx);
    setAnswered(true);

    const correct = idx === currentQ.correctIndex;
    setLastCorrect(correct);
    addQuizResult({ correct, difficulty: currentQ.difficulty });

    if (correct) {
      incrementQuizCombo();
      const baseCoins = currentQ.difficulty === 'facil' ? 10 : currentQ.difficulty === 'intermedio' ? 20 : 30;
      const comboBonus = quizCombo * 5;
      const totalCoins = baseCoins + comboBonus;
      const xpEarned = currentQ.difficulty === 'facil' ? 15 : currentQ.difficulty === 'intermedio' ? 25 : 40;
      playCorrect();
      earnCoins(totalCoins);
      earnXP(xpEarned);
      const newLevel = useGameStore.getState().level;
      if (newLevel > prevLevel.current) {
        playLevelUp();
        triggerConfetti();
        addToast({ type: 'levelup', title: `¡Nivel ${newLevel}!`, icon: '⭐', coins: newLevel * 10 });
        prevLevel.current = newLevel;
      }
      if (quizCombo + 1 >= 3) {
        playLevelUp();
        triggerConfetti();
        addToast({ type: 'combo', title: `🔥 Combo x${quizCombo + 1}!`, icon: '🔥', coins: comboBonus });
      }
      completeQuiz(currentQ.id);
      setScore(s => s + 1);
      const comboMsg = quizCombo >= 1 ? ` 🔥 Combo x${quizCombo + 1}! (+${comboBonus}🪙)` : '';
      setMascotText('¡Correcto!' + comboMsg + ' ' + currentQ.explanation.split('.')[0] + '.');
      setMascotMood('emocionado');
      hapticsSuccess();
      const newAchs = checkAchievements();
      newAchs.forEach(a => { playLevelUp(); triggerConfetti(); addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward }); });
    } else {
      playWrong();
      resetQuizCombo();
      setMascotText(currentQ.explanation);
      setMascotMood('pensativo');
      hapticsError();
      checkAchievements();
    }
  };

  const nextQuestion = () => {
    hapticsLight();
    advanceQuestion(lastCorrect, skillIdx, usedIds, questionNum);
  };

  const endSession = () => {
    const reward = Math.min(score * 5, 50);
    earnCoins(reward);
    earnXP(reward);
    setMascotText(`Respondiste ${questionNum} preguntas (${Math.round(score / Math.max(1, questionNum) * 100)}% correctas). +${reward}🪙`);
    setSessionActive(false);
  };

  if (!sessionActive) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🧠 Aprende</Text>
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-done" size={14} color={colors.green} />
              <Text style={styles.completedText}>{completedQuizIds.length} completados</Text>
            </View>
          </View>
          <HeaderActions />
          <MascotBubble text={mascotText} mood={mascotMood} />
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>Quiz Adaptativo</Text>
            <Text style={styles.startDesc}>Cada acierto te lleva a preguntas más retadoras. Cada fallo te regresa a preguntas más simples. ¡Siempre al nivel que necesitas!</Text>
            <Pressable onPress={startQuiz} style={styles.startBtn}>
              <Ionicons name="play" size={20} color={colors.white} />
              <Text style={styles.startBtnText}>Comenzar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (sessionActive && currentQ) {
    const qColor = questionColor(currentQ);
    const qLabel = questionLabel(currentQ);
    const qIcon = currentQ.difficulty === 'facil' ? 'leaf' : currentQ.difficulty === 'intermedio' ? 'trending-up' : 'flame';
    const pct = Math.min((skillIdx / (TOTAL_QS - 1)) * 100, 100);
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.quizHeader}>
            <Pressable onPress={endSession} style={styles.exitBtn}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.diffChip}>
              <Ionicons name={qIcon} size={14} color={qColor} />
              <Text style={[styles.diffChipText, { color: qColor }]}>{qLabel}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: qColor }]} />
            </View>
            <Text style={styles.progressText}>#{questionNum}</Text>
            {quizCombo >= 2 && (
              <Animated.View style={{ transform: [{ scale: comboPulse }] }}>
                <ComboBadge combo={quizCombo} />
              </Animated.View>
            )}
          </View>
          <MascotBubble text={mascotText} mood={mascotMood} />
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{currentQ.question}</Text>
            <View style={styles.optionsList}>
              {currentQ.options.map((opt, i) => (
                <OptionButton
                  key={i}
                  text={opt}
                  index={i}
                  correctIndex={currentQ.correctIndex}
                  selectedAnswer={selectedAnswer}
                  answered={answered}
                  onPress={() => handleAnswer(i)}
                />
              ))}
            </View>
            {quizCombo >= 2 && !answered && (
              <View style={styles.comboHint}>
                <Text style={styles.comboHintText}>🔥 Combo x{quizCombo} — ¡sigue así!</Text>
              </View>
            )}
            {answered && (
              <Pressable onPress={nextQuestion} style={[styles.nextBtn, { backgroundColor: questionColor(currentQ) }]}>
                <Text style={styles.nextBtnText}>Siguiente →</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.text },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.greenLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  completedText: { fontSize: fonts.sizes.xs, color: colors.green, fontWeight: '600' },
  startCard: { alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 32, gap: 16, ...shadows.card },
  startTitle: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.text },
  startDesc: { fontSize: fonts.sizes.md, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.purple, paddingHorizontal: 28, paddingVertical: 14, borderRadius: radius.full },
  startBtnText: { color: colors.white, fontWeight: '800', fontSize: fonts.sizes.lg },
  quizHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exitBtn: { width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  diffChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  diffChipText: { fontSize: fonts.sizes.xs, fontWeight: '700' },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.bgCard, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textMuted },
  comboBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  comboEmoji: { fontSize: 14 },
  comboText: { color: colors.white, fontWeight: '800', fontSize: fonts.sizes.sm },
  comboHint: { backgroundColor: colors.yellowLight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.lg, alignItems: 'center' },
  comboHintText: { color: colors.text, fontWeight: '700', fontSize: fonts.sizes.sm },
  questionCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 20, gap: 16, ...shadows.card },
  questionText: { color: colors.text, fontSize: fonts.sizes.lg, fontWeight: '700', lineHeight: 26 },
  optionsList: { gap: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 2 },
  optionRadio: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.purple },
  optionText: { flex: 1, fontSize: fonts.sizes.md, lineHeight: 22 },
  nextBtn: { paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center' },
  nextBtnText: { color: colors.white, fontWeight: '700', fontSize: fonts.sizes.md },
});
