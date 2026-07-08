import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import { searchPlayer, fetchFriends, sendFriendRequest, createChallenge, fetchChallenges, type FriendUser, type Challenge } from '../services/socialService';
import { hapticsSuccess, hapticsError, hapticsLight } from '../utils/haptics';

export default function AmigosScreen() {
  const { level } = useGameStore();
  const [activeTab, setActiveTab] = useState<'amigos' | 'retos'>('amigos');
  const [searchCode, setSearchCode] = useState('');
  const [searchedPlayer, setSearchedPlayer] = useState<FriendUser | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const handleSearch = useCallback(async () => {
    if (!searchCode.trim()) return;
    hapticsLight();
    const player = await searchPlayer(searchCode.trim());
    setSearchedPlayer(player || null);
    if (!player) hapticsError();
  }, [searchCode]);

  const handleAddFriend = useCallback(async (friendId: string) => {
    const ok = await sendFriendRequest('local-player', friendId);
    if (ok) {
      hapticsSuccess();
      Alert.alert('Solicitud enviada', 'El jugador recibirá tu solicitud de amistad.');
      setSearchedPlayer(null);
      setSearchCode('');
    } else {
      hapticsError();
      Alert.alert('Error', 'No se pudo enviar la solicitud. ¿Ya son amigos?');
    }
  }, []);

  const loadFriends = useCallback(async () => {
    const f = await fetchFriends('local-player');
    setFriends(f);
  }, []);

  const loadChallenges = useCallback(async () => {
    const c = await fetchChallenges('local-player');
    setChallenges(c);
  }, []);

  const handleChallenge = useCallback(async (friendId: string) => {
    const ok = await createChallenge('local-player', friendId, 'pnl');
    if (ok) {
      hapticsSuccess();
      Alert.alert('Reto creado', 'Tu amigo recibirá el reto. ¡A comerle!');
      loadChallenges();
    }
  }, [loadChallenges]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable onPress={() => { setActiveTab('amigos'); loadFriends(); }}
          style={[styles.tab, activeTab === 'amigos' && styles.tabActive]}>
          <Ionicons name="people" size={16} color={activeTab === 'amigos' ? colors.purple : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'amigos' && { color: colors.purple, fontWeight: '700' }]}>Amigos</Text>
        </Pressable>
        <Pressable onPress={() => { setActiveTab('retos'); loadChallenges(); }}
          style={[styles.tab, activeTab === 'retos' && styles.tabActive]}>
          <Ionicons name="trophy" size={16} color={activeTab === 'retos' ? colors.purple : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'retos' && { color: colors.purple, fontWeight: '700' }]}>Retos</Text>
        </Pressable>
      </View>

      {activeTab === 'amigos' ? (
        <FlatList
          data={friends}
          keyExtractor={f => f.id}
          contentContainerStyle={styles.list}
          onRefresh={loadFriends}
          refreshing={false}
          ListHeaderComponent={
            <View>
              {/* Search */}
              <View style={styles.searchRow}>
                <TextInput
                  value={searchCode}
                  onChangeText={setSearchCode}
                  placeholder="Buscar por código (ej: ABC123)"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCapitalize="characters"
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <Pressable onPress={handleSearch} style={styles.searchBtn}>
                  <Ionicons name="search" size={18} color={colors.white} />
                </Pressable>
              </View>

              {searchedPlayer && (
                <View style={styles.foundCard}>
                  <View style={styles.foundAvatar}>
                    <Text style={styles.avatarEmoji}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foundName}>{searchedPlayer.displayName}</Text>
                    <Text style={styles.foundInfo}>Nv.{searchedPlayer.level} · 🪙{searchedPlayer.coins}</Text>
                  </View>
                  <Pressable onPress={() => handleAddFriend(searchedPlayer.id)} style={styles.addBtn}>
                    <Ionicons name="person-add" size={18} color={colors.white} />
                  </Pressable>
                </View>
              )}
              <Text style={styles.sectionTitle}>Tus amigos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.friendCard}>
              <View style={[styles.friendOnline, { backgroundColor: item.isOnline ? colors.green : colors.textMuted }]} />
              <View style={styles.friendAvatar}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{item.displayName}</Text>
                <Text style={styles.friendInfo}>Nv.{item.level} · 🪙{item.coins}</Text>
              </View>
              <Pressable onPress={() => handleChallenge(item.id)} style={styles.challengeBtn}>
                <Ionicons name="flag" size={16} color={colors.purple} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Busca amigos por código{'\n'}para agregarlos</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          onRefresh={loadChallenges}
          refreshing={false}
          renderItem={({ item }) => {
            const isWin = item.winnerId === 'local-player';
            const isLoss = item.winnerId && item.winnerId !== 'local-player';
            const total = item.creatorScore + item.opponentScore || 1;
            const creatorPct = Math.min(100, (item.creatorScore / total) * 100);
            const opponentPct = Math.min(100, (item.opponentScore / total) * 100);
            return (
              <View style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeType}>
                    {item.type === 'pnl' ? '📈 Ganancias' : item.type === 'quiz_score' ? '🧠 Quiz' : '🏆 Misiones'}
                  </Text>
                  <View style={[styles.challengeStatus, {
                    backgroundColor: item.status === 'active' ? colors.greenLight : item.status === 'completed' ? colors.blueLight : colors.yellowLight,
                  }]}>
                    <Text style={[styles.challengeStatusText, {
                      color: item.status === 'active' ? colors.green : item.status === 'completed' ? colors.blue : colors.yellow,
                    }]}>
                      {item.status === 'active' ? 'Activo' : item.status === 'completed' ? 'Terminado' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.challengeOpponent}>Vs {item.opponentName}</Text>

                {/* Visual progress bar */}
                <View style={styles.vsRow}>
                  <Text style={styles.vsLabel}>Tú</Text>
                  <View style={styles.vsBarBg}>
                    <View style={[styles.vsBarFill, { width: `${creatorPct}%`, backgroundColor: colors.green }]} />
                  </View>
                  <Text style={styles.vsScore}>{item.creatorScore}</Text>
                </View>
                <View style={styles.vsRow}>
                  <Text style={styles.vsLabel}>{item.opponentName}</Text>
                  <View style={styles.vsBarBg}>
                    <View style={[styles.vsBarFill, { width: `${opponentPct}%`, backgroundColor: colors.coral }]} />
                  </View>
                  <Text style={styles.vsScore}>{item.opponentScore}</Text>
                </View>

                {item.status === 'completed' && (
                  <Text style={[styles.challengeResult, { color: isWin ? colors.green : isLoss ? colors.coral : colors.textMuted }]}>
                    {isWin ? '🎉 Ganaste!' : isLoss ? '😔 Perdiste' : 'Empate'}
                  </Text>
                )}
                <Text style={styles.challengeEnds}>Termina: {new Date(item.endsAt).toLocaleDateString()}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No tienes retos activos{'\n'}Reta a un amigo</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', padding: 16, paddingBottom: 0, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.xl, backgroundColor: colors.bgCard, flex: 1, justifyContent: 'center' },
  tabActive: { backgroundColor: colors.purpleLight, borderWidth: 1, borderColor: colors.purple },
  tabText: { fontSize: fonts.sizes.sm, color: colors.textMuted, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: fonts.sizes.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  searchBtn: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  foundCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenLight, borderRadius: radius.xl, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.green },
  foundAvatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 20 },
  foundName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  foundInfo: { fontSize: fonts.sizes.xs, color: colors.textMuted, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text, marginBottom: 8 },
  friendCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 14, ...shadows.card },
  friendOnline: { width: 8, height: 8, borderRadius: 4 },
  friendAvatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  friendName: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  friendInfo: { fontSize: fonts.sizes.xs, color: colors.textMuted, marginTop: 2 },
  challengeBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: fonts.sizes.md, color: colors.textMuted, textAlign: 'center' },
  challengeCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 16, gap: 8, ...shadows.card },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeType: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  challengeStatus: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  challengeStatusText: { fontSize: fonts.sizes.xs, fontWeight: '700' },
  challengeOpponent: { fontSize: fonts.sizes.sm, color: colors.textSecondary },
  challengeResult: { fontSize: fonts.sizes.md, fontWeight: '700' },
  challengeEnds: { fontSize: fonts.sizes.xs, color: colors.textMuted },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vsLabel: { fontSize: fonts.sizes.xs, fontWeight: '700', color: colors.textMuted, width: 60 },
  vsBarBg: { flex: 1, height: 10, backgroundColor: colors.bg, borderRadius: 999, overflow: 'hidden' },
  vsBarFill: { height: '100%', borderRadius: 999 },
  vsScore: { fontSize: fonts.sizes.xs, fontWeight: '700', color: colors.textMuted, width: 40, textAlign: 'right' },
});
