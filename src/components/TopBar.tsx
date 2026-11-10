import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { alpha, gradient, NEON, PALETTE, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { GlassSurface } from './GlassSurface';

interface Props {
  name: string;
  coins: number;
  best: number;
  onWallet: () => void;
  onProfile: () => void;
}

/** Avatar com anel em gradiente que pulsa suavemente. */
function Avatar({ name }: { name: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.avatarWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
          },
        ]}
      />
      <View style={[styles.avatar, gradient(135, [NEON.cyan, PALETTE.cobalt, PALETTE.electric], PALETTE.cobalt)]}>
        <Text style={styles.avatarText}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
      </View>
    </View>
  );
}

function Chip({ icon, text, tone, onPress, label }: { icon: string; text: string; tone: string; onPress?: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.chip,
        { borderColor: alpha(tone, hovered || pressed ? 0.9 : 0.4), backgroundColor: alpha(tone, hovered || pressed ? 0.26 : 0.12) },
      ]}
    >
      <AnimatedIcon glyph={icon} size={16} motion="float" speed={2400} />
      <Text style={[styles.chipText, { color: tone }]}>{text}</Text>
    </Pressable>
  );
}

/** Barra superior fixa de vidro: avatar + nome à esquerda; recorde e moedas à direita. */
export function TopBar({ name, coins, best, onWallet, onProfile }: Props) {
  return (
    <GlassSurface radius={22} style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Perfil e configurações" onPress={onProfile} style={styles.who}>
        <Avatar name={name} />
        <View style={styles.names}>
          <Text style={styles.hello}>BEM-VINDO</Text>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
        </View>
      </Pressable>
      <View style={styles.chips}>
        <Chip icon="🏆" text={String(best)} tone={NEON.gold} label={`Recorde ${best}`} />
        <View style={{ width: 8 }} />
        <Chip icon="🪙" text={String(coins)} tone={NEON.cyan} onPress={onWallet} label="Abrir loja" />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 60,
  },
  who: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minHeight: 48 },
  avatarWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: alpha(NEON.cyan, 0.45) },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  names: { marginLeft: 10, flexShrink: 1 },
  hello: { color: '#94a3b8', fontSize: 9, letterSpacing: 2, fontWeight: '800' },
  name: { color: '#f8fafc', fontSize: 15, fontWeight: '800', maxWidth: 120 },
  chips: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: { fontWeight: '900', fontSize: 14, marginLeft: 6 },
});
