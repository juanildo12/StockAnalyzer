import { Tabs, router } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../../src/constants/theme';

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  simulador: 'stats-chart',
  aprende: 'school',
  mision: 'compass',
  reels: 'videocam',
};

const TAB_LABELS: Record<string, string> = {
  simulador: 'Simulador',
  aprende: 'Aprende',
  mision: 'Misión',
  reels: 'Aprende',
};

const TAB_COLORS: Record<string, string> = {
  simulador: colors.green,
  aprende: colors.purple,
  mision: colors.blue,
  reels: colors.yellow,
};

function TabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          🧸 Juego educativo. Dinero y acciones ficticios. No es asesoría financiera real.
        </Text>
      </View>
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const color = isFocused ? TAB_COLORS[route.name] || colors.purple : colors.textMuted;
          const bgColor = isFocused ? `${TAB_COLORS[route.name] || colors.purple}15` : 'transparent';

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
              <View style={[styles.tabIconWrap, { backgroundColor: bgColor }]}>
                <Ionicons name={TAB_ICONS[route.name] || 'ellipse'} size={22} color={color} />
              </View>
              <Text style={[styles.tabLabel, { color }]}>{TAB_LABELS[route.name] || route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="simulador" options={{ title: 'Simulador' }} />
      <Tabs.Screen name="aprende" options={{ title: 'Aprende' }} />
      <Tabs.Screen name="mision" options={{ title: 'Misión' }} />
      <Tabs.Screen name="reels" options={{ title: 'Aprende' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimer: {
    backgroundColor: `${colors.text}E6`,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  disclaimerText: {
    color: colors.white,
    fontSize: fonts.sizes.xs - 1,
    textAlign: 'center',
    lineHeight: 14,
    opacity: 0.85,
  },
  tabBar: {
    flexDirection: 'row',
    paddingBottom: 4,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: '600',
  },
});
