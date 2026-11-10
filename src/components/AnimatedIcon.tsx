import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { USE_NATIVE_DRIVER } from '../theme';

export type Motion = 'float' | 'pulse' | 'spin' | 'wiggle';

interface Props {
  glyph: string;
  size?: number;
  motion?: Motion;
  /** When false the icon rests. */
  active?: boolean;
  /** Duration of one cycle, ms. */
  speed?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Emoji icon with a looping CSS-like animation (float, pulse, spin, wiggle). Runs at 60fps on the native driver. */
export function AnimatedIcon({
  glyph,
  size = 24,
  motion = 'float',
  active = true,
  speed = 1800,
  delay = 0,
  style,
}: Props) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      t.setValue(0);
      return;
    }
    const cfg = { useNativeDriver: USE_NATIVE_DRIVER };
    const loop =
      motion === 'spin'
        ? Animated.loop(Animated.timing(t, { toValue: 1, duration: speed, easing: Easing.linear, ...cfg }))
        : Animated.loop(
            Animated.sequence([
              Animated.timing(t, { toValue: 1, duration: speed / 2, easing: Easing.inOut(Easing.sin), ...cfg }),
              Animated.timing(t, { toValue: 0, duration: speed / 2, easing: Easing.inOut(Easing.sin), ...cfg }),
            ]),
          );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [active, motion, speed, delay, t]);

  const transform =
    motion === 'float'
      ? [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.28] }) }]
      : motion === 'pulse'
        ? [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }]
        : motion === 'spin'
          ? [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }]
          : [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) }];

  return (
    <Animated.Text style={[{ fontSize: size, lineHeight: size * 1.2, transform }, style as object]}>
      {glyph}
    </Animated.Text>
  );
}
