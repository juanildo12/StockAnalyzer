import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { useUIStore } from '../../src/store/uiStore';
import { theme } from '../../src/constants/theme';
import { SHOP_ITEMS } from '../../src/data/shop';
import { hapticsSelection, hapticsSuccess, hapticsError } from '../../src/utils/haptics';

export default function TiendaModal() {
  const coins = useGameStore(s => s.coins);
  const ownedSkins = useGameStore(s => s.ownedSkins);
  const ownedThemes = useGameStore(s => s.ownedThemes);
  const ownedPowerups = useGameStore(s => s.ownedPowerups);
  const ownedTrinkets = useGameStore(s => s.ownedTrinkets);
  const buyShopItem = useGameStore(s => s.buyShopItem);
  const equipSkin = useGameStore(s => s.equipSkin);
  const equipTheme = useGameStore(s => s.equipTheme);
  const equippedSkin = useGameStore(s => s.equippedSkin);
  const equippedTheme = useGameStore(s => s.equippedTheme);

  const isOwned = (item: typeof SHOP_ITEMS[0]) => {
    if (item.category === 'skin') return ownedSkins.includes(item.id);
    if (item.category === 'theme') return ownedThemes.includes(item.id);
    if (item.category === 'powerup') return ownedPowerups.includes(item.id);
    if (item.category === 'trinket') return ownedTrinkets.includes(item.id);
    return false;
  };

  const isEquipped = (item: typeof SHOP_ITEMS[0]) => {
    if (item.category === 'skin') return equippedSkin === item.id;
    if (item.category === 'theme') return equippedTheme === item.id;
    return false;
  };

  const handleAction = (item: typeof SHOP_ITEMS[0]) => {
    hapticsSelection();
    if (isOwned(item)) {
      if (item.category === 'skin') equipSkin(item.id);
      else if (item.category === 'theme') equipTheme(item.id);
      useUIStore.getState().setToast(`✅ Equipado: ${item.name}`, 'success');
    } else {
      if (coins < item.price) {
        hapticsError();
        useUIStore.getState().setToast('❌ No tienes suficientes coins', 'error');
        return;
      }
      hapticsSuccess();
      buyShopItem(item.id);
      useUIStore.getState().setToast(`✅ Comprado: ${item.name}`, 'success');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <Text style={{ fontSize: 24 }}>🪙</Text>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>{coins}</Text>
      </View>

      {(['skin', 'theme', 'powerup', 'trinket'] as const).map(cat => {
        const items = SHOP_ITEMS.filter(i => i.category === cat);
        const catLabel = { skin: '🎭 Skins', theme: '🎨 Temas', powerup: '⚡ Power-ups', trinket: '🧿 Accesorios' }[cat];
        return (
          <View key={cat} style={{ gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{catLabel}</Text>
            {items.map(item => {
              const owned = isOwned(item);
              const equipped = isEquipped(item);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleAction(item)}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                    flexDirection: 'row', gap: 12, alignItems: 'center',
                    borderWidth: equipped ? 2 : 0,
                    borderColor: theme.primary,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    {owned ? (
                      <Text style={{ color: equipped ? theme.gain : theme.primary, fontSize: 13, fontWeight: '700' }}>
                        {equipped ? '✅ Equipado' : '✔️ Usar'}
                      </Text>
                    ) : (
                      <>
                        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>🪙{item.price}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 10, textTransform: 'capitalize' }}>{item.rarity}</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}
