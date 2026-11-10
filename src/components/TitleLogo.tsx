import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NEON, USE_NATIVE_DRIVER } from '../theme';
import { Block } from './Piece';

interface FloatingCubeProps {
  color: number;
  size: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  duration: number;
  delay: number;
}

/** A 3D block that bobs up and down while slowly tilting. */
function FloatingCube({ color, size, duration, delay, ...pos }: FloatingCubeProps) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [duration, delay, t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cube,
        pos,
        {
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '14deg'] }) },
          ],
        },
      ]}
    >
      <Block color={color} size={size} />
    </Animated.View>
  );
}

/** Neon game title with floating 3D cubes around it. */
export function TitleLogo({ compact }: { compact?: boolean }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 32, 380);
  const big = compact ? 40 : 54;
  const small = compact ? 26 : 34;
  const flicker = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(flicker, { toValue: 0.78, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(flicker, { toValue: 1, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(flicker, { toValue: 0.86, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(flicker, { toValue: 1, duration: 120, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);

  return (
    <View style={{ width: w, height: compact ? 118 : 150, alignItems: 'center', justifyContent: 'center' }}>
      <FloatingCube color={2} size={30} left={4} top={4} duration={2200} delay={0} />
      <FloatingCube color={6} size={24} right={6} top={0} duration={2600} delay={300} />
      <FloatingCube color={4} size={26} left={26} bottom={2} duration={2400} delay={600} />
      <FloatingCube color={3} size={22} right={22} bottom={8} duration={2000} delay={900} />
      <Animated.View style={{ alignItems: 'center', opacity: flicker }}>
        <Text style={[styles.tycoon, { fontSize: big, lineHeight: big * 1.1 }]}>TYCOON</Text>
        <Text style={[styles.game, { fontSize: small, lineHeight: small * 1.2 }]}>GAME</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cube: { position: 'absolute' },
  tycoon: {
    color: '#ecfeff',
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: NEON.cyan,
    textShadowRadius: 22,
    textShadowOffset: { width: 0, height: 0 },
  },
  game: {
    color: '#fdf2f8',
    fontWeight: '900',
    letterSpacing: 14,
    marginLeft: 14,
    textShadowColor: NEON.pink,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
});
