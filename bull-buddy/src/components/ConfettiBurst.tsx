import { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLORS = ['#FF6B6B', '#3FD6A0', '#FFC93C', '#9B5DE5', '#4EC5F1', '#FF69B4', '#FFD700'];
const PARTICLE_COUNT = 30;

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
}

export default function ConfettiBurst() {
  const particles = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 100),
      y: new Animated.Value(SCREEN_HEIGHT / 2),
      rotation: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 8 + Math.random() * 12,
    }))
  ).current;

  useEffect(() => {
    const anims = particles.map(p =>
      Animated.parallel([
        Animated.timing(p.x, {
          toValue: (Math.random() - 0.5) * SCREEN_WIDTH * 1.2,
          duration: 1000 + Math.random() * 500,
          useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: SCREEN_HEIGHT + 100,
          duration: 1000 + Math.random() * 500,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotation, {
          toValue: Math.random() * 720 - 360,
          duration: 1000 + Math.random() * 500,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 800 + Math.random() * 400,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.stagger(30, anims).start();
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 4,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 },
  particle: { position: 'absolute' },
});
