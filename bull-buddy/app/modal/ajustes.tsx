import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../src/constants/theme';

export default function AjustesModal() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>🎵 Créditos de sonido</Text>
      <View style={styles.creditCard}>
        <View style={styles.creditRow}>
          <Ionicons name="musical-note" size={18} color={colors.purple} />
          <Text style={styles.creditText}>
            <Text style={styles.creditBold}>Mugidos de toro</Text>
            {'\n'}BigSoundBank.com — "ANMLFarm Cow moos, ID 0546"
            {'\n'}Licencia CC0 (dominio público)
          </Text>
        </View>
        <View style={styles.creditRow}>
          <Ionicons name="musical-note" size={18} color={colors.blue} />
          <Text style={styles.creditText}>
            <Text style={styles.creditBold}>Efectos adicionales</Text>
            {'\n'}Generados por código (Web Audio API / síntesis WAV)
          </Text>
        </View>
        <Text style={styles.legalNote}>
          Todos los sonidos se reproducen localmente, sin conexión a internet.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>ℹ️ Acerca de</Text>
      <View style={styles.creditCard}>
        <Text style={styles.aboutText}>
          Bull Buddy es un juego educativo de simulacion de la bolsa de valores de EE.UU.,
          disenado para principiantes. Todo el dinero y las acciones son ficticios.
        </Text>
        <Text style={styles.versionText}>Version 1.0.0 — Expo SDK 57</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, gap: 16 },
  sectionTitle: { fontSize: fonts.sizes.lg, fontWeight: '800', color: colors.text, marginTop: 8 },
  creditCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 18,
    gap: 14, borderWidth: 1, borderColor: colors.border,
  },
  creditRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  creditText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.textSecondary, lineHeight: 20 },
  creditBold: { fontWeight: '700', color: colors.text },
  legalNote: { fontSize: fonts.sizes.xs, color: colors.textMuted, fontStyle: 'italic' },
  aboutText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, lineHeight: 20 },
  versionText: { fontSize: fonts.sizes.xs, color: colors.textMuted, marginTop: 8 },
});
