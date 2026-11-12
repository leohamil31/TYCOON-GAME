import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { haptic, play } from '../services/sfx';
import { useProgress } from '../state/useProgress';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';

/** Comemoração "NÍVEL N! +1 baú" que aparece por cima de qualquer tela ao subir de nível. */
export function LevelUpBanner() {
  const { levelUp, clearLevelUp } = useProgress();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (levelUp === null) return;
    play('levelUp');
    haptic([30, 40, 30, 40, 60]);
    v.setValue(0);
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 6, tension: 160, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.delay(2200),
      Animated.timing(v, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(({ finished }) => finished && clearLevelUp());
  }, [levelUp, v, clearLevelUp]);

  if (levelUp === null) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
          ],
        },
      ]}
    >
      <Pressable onPress={clearLevelUp} style={[styles.card, glassStrong, { backgroundColor: 'rgba(30,27,75,0.96)' }]}>
        <Text style={styles.big}>⬆️ NÍVEL {levelUp}!</Text>
        <Text style={styles.sub}>Você ganhou 1 baú 🎁 — abra no menu</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', zIndex: 200 },
  card: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: alpha(NEON.violet, 0.9),
    alignItems: 'center',
    shadowColor: NEON.violet,
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  big: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2, textShadowColor: NEON.violet, textShadowRadius: 14 },
  sub: { color: '#ddd6fe', fontSize: 12.5, fontWeight: '700', marginTop: 2 },
});
