import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';

export interface ToastMsg {
  id: number;
  text: string;
  icon?: string;
  kind?: 'ok' | 'error' | 'info';
}

/** Aviso rápido que desce, fica ~1,6s e some. Remonta a cada id novo. */
export function Toast({ msg }: { msg: ToastMsg | null }) {
  if (!msg) return null;
  return <ToastImpl key={msg.id} msg={msg} />;
}

function ToastImpl({ msg }: { msg: ToastMsg }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 8, tension: 260, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.delay(1100),
      Animated.timing(v, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [v]);

  const tone = msg.kind === 'error' ? '#f87171' : msg.kind === 'ok' ? NEON.green : NEON.cyan;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        glassStrong,
        {
          borderColor: alpha(tone, 0.7),
          shadowColor: tone,
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.text, { color: tone === NEON.cyan ? '#e0f2fe' : tone }]}>
        {msg.icon ? `${msg.icon}  ` : ''}
        {msg.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    maxWidth: '92%',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    zIndex: 50,
    shadowOpacity: 0.6,
    shadowRadius: 14,
  },
  text: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
