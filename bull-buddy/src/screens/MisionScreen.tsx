import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import MascotBubble from '../components/MascotBubble';
import HeaderActions from '../components/HeaderActions';
import { MISSIONS } from '../data/missions';
import { hapticsSuccess, hapticsError, hapticsLight, hapticsMedium } from '../utils/haptics';
import { checkAchievements } from '../utils/achievements';
import { useUIStore } from '../store/uiStore';
import type { MascotMood } from '../types';

export default function MisionScreen() {
  const { completedMissionIds, earnCoins, earnXP, completeMission } = useGameStore();
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [missionDone, setMissionDone] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [mascotText, setMascotText] = useState('¡Elige una misión y vive una aventura financiera!');
  const [mascotMood, setMascotMood] = useState<MascotMood>('feliz');
  const { triggerConfetti, addToast } = useUIStore();
  const prevLevel = useRef(useGameStore.getState().level);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const mission = MISSIONS.find(m => m.id === selectedMission);

  useEffect(() => {
    slideAnim.setValue(20);
    Animated.spring(slideAnim, { toValue: 0, friction: 7, useNativeDriver: true }).start();
  }, [currentStepId, missionDone]);

  const celebrateLevelUp = useCallback((newLevel: number) => {
    if (newLevel > prevLevel.current) {
      triggerConfetti();
      addToast({ type: 'levelup', title: `¡Nivel ${newLevel}!`, icon: '⭐', coins: newLevel * 10 });
      prevLevel.current = newLevel;
    }
  }, [triggerConfetti, addToast]);

  const startMission = useCallback((id: string) => {
    const m = MISSIONS.find(mi => mi.id === id);
    if (!m) return;
    setSelectedMission(id);
    setCurrentStepId(m.steps[0].id);
    setHistory([]);
    setMissionDone(false);
    setTotalCoins(0);
    setTotalXP(0);
    setMascotText(m.steps[0].narrative);
    setMascotMood('pensativo');
  }, []);

  const handleChoice = (nextStepId: string | null, coinsReward: number, xpReward: number, isCorrect: boolean) => {
    setTotalCoins(c => c + coinsReward);
    setTotalXP(x => x + xpReward);
    setHistory(h => [...h, isCorrect ? '✅' : '❌']);

    if (isCorrect) {
      hapticsSuccess();
      setMascotMood('emocionado');
    } else {
      hapticsError();
      setMascotMood('pensativo');
    }

    if (nextStepId && stepHasOptions(nextStepId)) {
      const step = findStep(nextStepId);
      if (step) {
        setTimeout(() => {
          setCurrentStepId(nextStepId);
          setMascotText(step.narrative);
        }, 300);
      }
    } else {
      const m = MISSIONS.find(mi => mi.id === selectedMission);
      if (m) {
        completeMission(m.id);
        earnCoins(totalCoins + coinsReward);
        earnXP(totalXP + xpReward);
        celebrateLevelUp(useGameStore.getState().level);
        const newAchs = checkAchievements();
        newAchs.forEach(a => { triggerConfetti(); addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward }); });
        setTimeout(() => {
          setMascotText(m.steps.find(s => s.id === nextStepId)?.narrative || '¡Misión completada!');
          setMascotMood('feliz');
          setMissionDone(true);
        }, 500);
        hapticsMedium();
      }
    }
  };

  const findStep = (stepId: string) => {
    const m = MISSIONS.find(mi => mi.id === selectedMission);
    return m?.steps.find(s => s.id === stepId);
  };

  const stepHasOptions = (stepId: string): boolean => {
    const step = findStep(stepId);
    return step ? step.options.length > 0 : false;
  };

  const currentStep = findStep(currentStepId);
  const hasOptions = currentStep ? currentStep.options.length > 0 : false;

  if (!selectedMission) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🍋 Misión</Text>
            <View style={styles.completedBadge}>
              <Ionicons name="flag" size={14} color={colors.blue} />
              <Text style={styles.completedText}>{completedMissionIds.length}/{MISSIONS.length} completadas</Text>
            </View>
          </View>
          <HeaderActions />
          <MascotBubble text={mascotText} mood={mascotMood} />
          <Text style={styles.sectionTitle}>Elige tu aventura</Text>
          {MISSIONS.sort((a, b) => a.order - b.order).map(m => {
            const done = completedMissionIds.includes(m.id);
            return (
              <Pressable key={m.id}
                onPress={() => !done && startMission(m.id)}
                style={[styles.missionCard, done && styles.missionCardDone]}>
                <View style={[styles.missionIconWrap, { backgroundColor: done ? colors.greenLight : colors.blueLight }]}>
                  <Text style={styles.missionEmoji}>{m.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.missionTitle, done && { color: colors.textMuted }]}>
                    {done && '✅ '}{m.title}
                  </Text>
                  <Text style={styles.missionDesc}>{m.description}</Text>
                  <Text style={styles.missionConcept}>📖 {m.conceptLearned}</Text>
                </View>
                {done ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.green} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!currentStep) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView contentContainerStyle={styles.scroll} style={{ opacity: slideAnim.interpolate({ inputRange: [0, 20], outputRange: [1, 0.5] }) }}>
        <View style={styles.missionHeader}>
          <Pressable onPress={() => setSelectedMission(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.missionTitleSmall}>{mission?.title}</Text>
            <Text style={styles.missionProgress}>
              {missionDone ? 'Completada' : `${history.filter(h => h === '✅').length} aciertos · +${totalCoins}🪙 +${totalXP}XP`}
            </Text>
          </View>
        </View>

        <MascotBubble text={mascotText} mood={mascotMood} />

        {!missionDone && (
          <Animated.View style={[styles.narrativeCard, { transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.narrativeText}>{currentStep?.narrative}</Text>
          </Animated.View>
        )}

        {hasOptions && !missionDone && (
          <View style={styles.optionsList}>
            {currentStep.options.map(opt => (
              <Pressable key={opt.id}
                onPress={() => handleChoice(opt.nextStepId, opt.coinsReward, opt.xpReward, opt.isCorrect)}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
                ]}>
                <Text style={styles.choiceText}>{opt.text}</Text>
                <View style={styles.choiceMeta}>
                  {opt.isCorrect && opt.coinsReward > 0 && (
                    <Text style={styles.choiceReward}>+{opt.coinsReward}🪙 +{opt.xpReward}XP</Text>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {missionDone && (
          <Animated.View style={[styles.resultCard, { transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.resultEmoji}>🎉</Text>
            <Text style={styles.resultTitle}>Misión Completada</Text>
            <Text style={styles.resultConcept}>📖 {mission?.conceptLearned}</Text>
            <View style={styles.resultStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>+{totalCoins} 🪙</Text>
                <Text style={styles.statLabel}>Monedas</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>+{totalXP} XP</Text>
                <Text style={styles.statLabel}>Experiencia</Text>
              </View>
            </View>
            <Pressable onPress={() => { setSelectedMission(null); hapticsLight(); }} style={styles.backToMissions}>
              <Text style={styles.backToMissionsText}>Volver a misiones</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.text },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blueLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  completedText: { fontSize: fonts.sizes.xs, color: colors.blue, fontWeight: '600' },
  sectionTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text, marginTop: 4 },
  missionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 16, gap: 14, ...shadows.card },
  missionCardDone: { opacity: 0.7 },
  missionIconWrap: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  missionEmoji: { fontSize: 24 },
  missionTitle: { color: colors.text, fontWeight: '700', fontSize: fonts.sizes.md },
  missionDesc: { color: colors.textMuted, fontSize: fonts.sizes.sm, marginTop: 2 },
  missionConcept: { color: colors.blue, fontSize: fonts.sizes.xs, marginTop: 4, fontWeight: '500' },
  missionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  missionTitleSmall: { color: colors.text, fontWeight: '700', fontSize: fonts.sizes.md },
  missionProgress: { color: colors.textMuted, fontSize: fonts.sizes.xs, marginTop: 2 },
  narrativeCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 20, ...shadows.card },
  narrativeText: { color: colors.text, fontSize: fonts.sizes.md, lineHeight: 24 },
  optionsList: { gap: 10 },
  choiceBtn: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.borderLight, ...shadows.card },
  choiceText: { flex: 1, color: colors.text, fontSize: fonts.sizes.md, fontWeight: '600' },
  choiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceReward: { fontSize: fonts.sizes.xs, color: colors.yellow, fontWeight: '600' },
  resultCard: { alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 28, gap: 12, ...shadows.card },
  resultEmoji: { fontSize: 48 },
  resultTitle: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text },
  resultConcept: { fontSize: fonts.sizes.sm, color: colors.blue, fontWeight: '600' },
  resultStats: { flexDirection: 'row', gap: 24, marginVertical: 8 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: fonts.sizes.lg, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: fonts.sizes.xs, color: colors.textMuted },
  backToMissions: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: radius.lg, backgroundColor: colors.purpleLight, borderWidth: 1, borderColor: colors.purple, marginTop: 8 },
  backToMissionsText: { color: colors.purple, fontWeight: '700', fontSize: fonts.sizes.md },
});
