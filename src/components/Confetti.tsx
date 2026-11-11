import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BLOCK_COLORS } from '../constants';
import { USE_NATIVE_DRIVER } from '../theme';

const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

interface Props {
  /** Quantidade de pedaços. */
  count?: number;
  /** Duração de uma queda, ms. */
  duration?: number;
  /** Repetições da chuva (Infinity = sem fim). */
  loops?: number;
}

/** Chuva de confete leve: um único Animated.Value movimenta todos os pedaços (só transform/opacity). */
export const Confetti = memo(function Confetti({ count = 40, duration = 2600, loops = 2 }: Props) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fall = Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER });
    const anim = Animated.loop(
      Animated.sequence([Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }), fall]),
      {
        iterations: loops,
      },
    );
    anim.start();
    return () => anim.stop();
  }, [t, duration, loops]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => {
        const x = rand(i + 1) * width;
        const drift = (rand(i + 2) - 0.5) * 120;
        const delay = rand(i + 3) * 0.45; // fração da queda em que o pedaço aparece
        const size = 6 + rand(i + 4) * 7;
        const spin = (rand(i + 5) > 0.5 ? 1 : -1) * (360 + rand(i + 6) * 540);
        const end = Math.min(1, delay + 0.55 + rand(i + 7) * 0.2);
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: -20,
              width: size,
              height: size * (i % 3 === 0 ? 1 : 0.45),
              borderRadius: i % 3 === 0 ? size / 2 : 2,
              backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length],
              opacity: t.interpolate({
                inputRange: [0, delay, delay + 0.02, end * 0.9, end],
                outputRange: [0, 0, 1, 1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: t.interpolate({
                    inputRange: [0, delay, end],
                    outputRange: [0, 0, height + 40],
                    extrapolate: 'clamp',
                  }),
                },
                { translateX: t.interpolate({ inputRange: [0, delay, end], outputRange: [0, 0, drift], extrapolate: 'clamp' }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
});
