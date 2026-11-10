import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { alpha, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { GlassSurface } from './GlassSurface';

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  tone: string;
  onPress: () => void;
}

function NavButton({ item }: { item: NavItem }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, friction: 6, tension: 220, useNativeDriver: USE_NATIVE_DRIVER }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={item.onPress}
      onHoverIn={() => to(1.08)}
      onHoverOut={() => to(1)}
      onPressIn={() => to(0.92)}
      onPressOut={() => to(1)}
      style={styles.item}
    >
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => (
        <Animated.View style={[styles.itemInner, { transform: [{ scale }] }]}>
          <View
            style={[
              styles.tile,
              {
                borderColor: alpha(item.tone, hovered || pressed ? 0.95 : 0.3),
                backgroundColor: alpha(item.tone, hovered || pressed ? 0.3 : 0.1),
                shadowColor: item.tone,
                shadowOpacity: hovered || pressed ? 0.8 : 0,
              },
            ]}
          >
            <AnimatedIcon glyph={item.icon} size={22} motion="float" speed={2600} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Barra de navegação inferior de vidro; cada alvo de toque tem pelo menos 48px. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <GlassSurface radius={26} style={styles.bar}>
      {items.map((it) => (
        <NavButton key={it.key} item={it} />
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 6 },
  item: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  itemInner: { alignItems: 'center' },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  label: { color: '#cbd5e1', fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
});
