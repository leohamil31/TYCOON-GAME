import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { alpha, gradient, PALETTE, USE_NATIVE_DRIVER } from '../theme';

function Orb({ color, size, x, y, dx, dy, duration }: { color: string; size: number; x: number; y: number; dx: number; dy: number; duration: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        gradient(135, [alpha(color, 0.55), alpha(color, 0)], alpha(color, 0.18)),
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: x,
          top: y,
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          ],
        },
      ]}
    />
  );
}

/** Auras em gradiente (cobalto, roxo elétrico, ciano) que flutuam devagar sobre o fundo; só transform → 60 FPS. */
export function AmbientOrbs() {
  const { width, height } = useWindowDimensions();
  const s = Math.max(width, height);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Orb color={PALETTE.electric} size={s * 0.7} x={-s * 0.2} y={-s * 0.15} dx={40} dy={60} duration={7000} />
      <Orb color={PALETTE.cobalt} size={s * 0.6} x={width - s * 0.4} y={height * 0.3} dx={-50} dy={-40} duration={8500} />
      <Orb color={PALETTE.cyan} size={s * 0.45} x={width * 0.1} y={height * 0.7} dx={60} dy={-50} duration={9500} />
      <View style={[StyleSheet.absoluteFill, gradient(180, ['rgba(4,6,15,0.55)', 'rgba(4,6,15,0)', 'rgba(4,6,15,0.7)'], 'rgba(4,6,15,0.25)')]} />
    </View>
  );
}

const styles = StyleSheet.create({ orb: { position: 'absolute' } });
