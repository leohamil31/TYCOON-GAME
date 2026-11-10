import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { alpha, glass, gradient, PALETTE, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon, type Motion } from './AnimatedIcon';

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  iconMotion?: Motion;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
  /** Entrance stagger, ms. */
  delay?: number;
  compact?: boolean;
  /** Pulsação leve em loop (CTA principal). */
  pulse?: boolean;
}

/** Glassmorphism button: entrance animation, hover/press scale, neon glow and a periodic shine sweep. */
export function GlassButton({
  title,
  subtitle,
  icon,
  iconMotion = 'wiggle',
  tone,
  onPress,
  disabled,
  delay = 0,
  compact,
  pulse,
}: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
  const [hover, setHover] = useState(false);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(beat, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, beat]);
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400 + delay),
        Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, enter, shine]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, friction: 6, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
          { scale },
          { scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}
        onHoverIn={() => {
          setHover(true);
          to(1.035);
        }}
        onHoverOut={() => {
          setHover(false);
          to(1);
        }}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(hover ? 1.035 : 1)}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[
          styles.btn,
          glass,
          compact && styles.compact,
          {
            borderColor: alpha(tone, hover ? 0.95 : 0.55),
            ...gradient(135, [alpha(tone, hover ? 0.5 : 0.34), alpha(PALETTE.electric, hover ? 0.4 : 0.22), alpha(PALETTE.cobalt, 0.2)], alpha(tone, 0.22)),
            shadowColor: tone,
            shadowOpacity: hover ? 0.75 : 0.4,
            shadowRadius: hover ? 26 : 14,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: alpha(tone, 0.28) }]}>
            <AnimatedIcon glyph={icon} size={compact ? 22 : 28} motion={iconMotion} speed={1500} />
          </View>
        )}
        <View style={styles.texts}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shine,
            {
              transform: [
                { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-90, width + 90] }) },
                { skewX: '-20deg' },
              ],
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  compact: { paddingVertical: 10, borderRadius: 16, minHeight: 52 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  texts: { flex: 1 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  sub: { color: 'rgba(226,232,240,0.75)', fontSize: 12, marginTop: 2 },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
