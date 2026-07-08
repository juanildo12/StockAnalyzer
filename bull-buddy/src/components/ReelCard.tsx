import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { colors, fonts, radius, shadows } from '../constants/theme';
import type { ReelLesson, ReelQuiz } from '../data/reelsContent';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ReelCardType =
  | { kind: 'series-header'; title: string; icon: string; color: string }
  | { kind: 'lesson'; lesson: ReelLesson; seriesColor: string; seriesTitle: string }
  | { kind: 'quiz'; quiz: ReelQuiz; seriesColor: string; seriesTitle: string; onComplete: (correct: boolean, coins: number, xp: number) => void };

interface Props {
  item: ReelCardType;
  index: number;
}

export default function ReelCard({ item, index }: Props) {
  if (item.kind === 'series-header') {
    return (
      <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.card, styles.headerCard, { borderColor: item.color }]}>
        <Text style={styles.headerIcon}>{item.icon}</Text>
        <Text style={styles.headerTitle}>{item.title}</Text>
        <View style={styles.headerDots}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, { backgroundColor: item.color }]} />
          ))}
        </View>
        <Text style={styles.headerHint}>Desliza hacia arriba para empezar</Text>
        <Ionicons name="chevron-up" size={28} color={item.color} style={{ marginTop: 8 }} />
      </Animated.View>
    );
  }

  if (item.kind === 'lesson') {
    return (
      <Animated.View entering={FadeInUp.delay(150).springify()} style={[styles.card, styles.lessonCard]}>
        <View style={[styles.seriesTag, { backgroundColor: item.seriesColor }]}>
          <Text style={styles.seriesTagText}>{item.seriesTitle}</Text>
        </View>
        <Text style={styles.lessonEmoji}>{item.lesson.emoji}</Text>
        <Text style={styles.lessonTitle}>{item.lesson.title}</Text>
        <Text style={styles.lessonContent}>{item.lesson.content}</Text>
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>{item.lesson.tip}</Text>
        </View>
      </Animated.View>
    );
  }

  return <QuizCard quiz={item.quiz} seriesColor={item.seriesColor} seriesTitle={item.seriesTitle} onComplete={item.onComplete} />;
}

function QuizCard({ quiz, seriesColor, seriesTitle, onComplete }: { quiz: ReelQuiz; seriesColor: string; seriesTitle: string; onComplete: (correct: boolean, coins: number, xp: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const correct = idx === quiz.correctIndex;
    onComplete(correct, correct ? 30 : 5, correct ? 40 : 10);
  };

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.card, styles.quizCard]}>
      <View style={[styles.seriesTag, { backgroundColor: seriesColor }]}>
        <Text style={styles.seriesTagText}>🧠 Mini-quiz: {seriesTitle}</Text>
      </View>
      <Text style={styles.quizQuestion}>{quiz.question}</Text>
      <View style={styles.quizOptions}>
        {quiz.options.map((opt, idx) => {
          let bg = colors.bgCard;
          let border = colors.border;
          let textColor = colors.text;
          if (answered) {
            if (idx === quiz.correctIndex) { bg = colors.greenLight; border = colors.green; textColor = colors.green; }
            else if (idx === selected) { bg = colors.coralLight; border = colors.coral; textColor = colors.coral; }
          } else if (selected === idx) {
            bg = colors.purpleLight; border = colors.purple;
          }

          return (
            <Pressable key={idx} onPress={() => handleSelect(idx)}
              style={[styles.quizOption, { backgroundColor: bg, borderColor: border }]}>
              <View style={[styles.quizRadio,
                answered && idx === quiz.correctIndex && { backgroundColor: colors.green },
                answered && idx === selected && idx !== quiz.correctIndex && { backgroundColor: colors.coral }]}>
                {answered && idx === quiz.correctIndex && <Ionicons name="checkmark" size={12} color={colors.white} />}
                {answered && idx === selected && idx !== quiz.correctIndex && <Ionicons name="close" size={12} color={colors.white} />}
              </View>
              <Text style={[styles.quizOptionText, { color: textColor }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <View style={[styles.quizExplanation, { backgroundColor: selected === quiz.correctIndex ? colors.greenLight : colors.coralLight }]}>
          <Text style={[styles.quizExplanationText, { color: selected === quiz.correctIndex ? colors.green : colors.coral }]}>
            {selected === quiz.correctIndex ? '✅ ' : '❌ '}
            {quiz.explanation}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
    justifyContent: 'center',
  },
  headerCard: {
    backgroundColor: colors.bg,
    borderLeftWidth: 6,
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: { fontSize: 64, marginBottom: 8 },
  headerTitle: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  headerDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, opacity: 0.6 },
  headerHint: { fontSize: fonts.sizes.md, color: colors.textMuted, textAlign: 'center' },
  lessonCard: {
    backgroundColor: colors.bg,
    gap: 10,
  },
  seriesTag: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.full,
  },
  seriesTagText: { color: colors.white, fontSize: fonts.sizes.xs, fontWeight: '700' },
  lessonEmoji: { fontSize: 56, textAlign: 'center', marginBottom: 4 },
  lessonTitle: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  lessonContent: { fontSize: fonts.sizes.md, color: colors.textSecondary, lineHeight: 24, textAlign: 'center', paddingHorizontal: 10 },
  tipBox: {
    backgroundColor: colors.yellowLight, borderRadius: radius.lg, padding: 14,
    marginHorizontal: 10, marginTop: 8,
  },
  tipText: { fontSize: fonts.sizes.sm, color: colors.text, fontWeight: '600', lineHeight: 20 },
  quizCard: {
    backgroundColor: colors.bg,
    gap: 12,
  },
  quizQuestion: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.text, textAlign: 'center', marginVertical: 12 },
  quizOptions: { gap: 10, paddingHorizontal: 10 },
  quizOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 2 },
  quizRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  quizOptionText: { flex: 1, fontSize: fonts.sizes.md, lineHeight: 22 },
  quizExplanation: { borderRadius: radius.lg, padding: 14, marginHorizontal: 10 },
  quizExplanationText: { fontSize: fonts.sizes.sm, fontWeight: '600', lineHeight: 20 },
});
