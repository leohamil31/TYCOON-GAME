import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { alpha, gradient, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';

export interface PowerChip {
  id: string;
  icon: string;
  label: string;
  count: number;
  tone: string;
  /** Efeito em andamento (ex.: x2 ativo). */
  active?: boolean;
  /** Texto curto no lugar do contador enquanto ativo (ex.: "4 jog."). */
  activeText?: string;
  /** Não pode ser usado agora (mas ainda pode abrir a loja se o estoque for 0). */
  disabled?: boolean;
  /** Sem contador (botão da loja). */
  noBadge?: boolean;
}

interface Props {
  chips: PowerChip[];
  onUse: (id: string) => void;
  onShop: () => void;
  /** Largura disponível: define o tamanho dos botões. */
  width: number;
  compact?: boolean;
  /** Mostra o botão da loja no fim da fileira. */
  showShop?: boolean;
  /** Quantos botões dividem a largura (para alinhar duas fileiras). */
  slots?: number;
}

function Chip({ chip, size, onPress }: { chip: PowerChip; size: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const prev = useRef(chip.count);
  const bump = useRef(new Animated.Value(1)).current;
  const empty = chip.count <= 0 && !chip.active;

  useEffect(() => {
    if (!chip.active) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [chip.active, glow]);

  // Pulinho no contador quando o estoque muda (compra ou uso).
  useEffect(() => {
    if (prev.current === chip.count) return;
    prev.current = chip.count;
    bump.setValue(1.5);
    Animated.spring(bump, { toValue: 1, friction: 4, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [chip.count, bump]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, friction: 5, tension: 260, useNativeDriver: USE_NATIVE_DRIVER }).start();
  const off = !!chip.disabled && !empty;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? `${chip.label}: comprar na loja` : `Usar ${chip.label}`}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      onPressIn={() => to(0.9)}
      onPressOut={() => to(1)}
      onHoverIn={() => to(1.06)}
      onHoverOut={() => to(1)}
      style={{ opacity: off ? 0.4 : 1 }}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            width: size,
            borderColor: alpha(chip.tone, chip.active ? 1 : empty ? 0.25 : 0.55),
            ...gradient(160, [alpha(chip.tone, chip.active ? 0.5 : 0.24), 'rgba(8,12,30,0.75)'], alpha(chip.tone, 0.18)),
            shadowColor: chip.tone,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.glow, { backgroundColor: alpha(chip.tone, 0.35), opacity: glow }]}
        />
        <AnimatedIcon
          glyph={chip.icon}
          size={size * 0.36}
          motion={chip.active ? 'pulse' : 'float'}
          speed={chip.active ? 900 : 2400}
          active={!empty}
        />
        <Text numberOfLines={1} style={[styles.label, { fontSize: Math.max(9, size * 0.15) }]}>
          {chip.label}
        </Text>
        {!chip.noBadge && (
          <Animated.View
            style={[
              styles.badge,
              { backgroundColor: empty ? 'rgba(148,163,184,0.85)' : chip.tone, transform: [{ scale: bump }] },
            ]}
          >
            <Text style={styles.badgeText}>{chip.active && chip.activeText ? chip.activeText : empty ? '+' : chip.count}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Barra de power-ups da partida (solo e online). Item sem estoque abre a loja. */
export function PowerBar({ chips, onUse, onShop, width, compact, showShop = true, slots }: Props) {
  const gap = 8;
  const per = slots ?? chips.length + (showShop ? 1 : 0);
  const size = Math.max(50, Math.min(compact ? 64 : 74, (width - gap * (per - 1)) / per));
  return (
    <View style={[styles.bar, { gap }]}>
      {chips.map((c) => (
        <Chip key={c.id} chip={c} size={size} onPress={() => (c.count <= 0 && !c.active ? onShop() : onUse(c.id))} />
      ))}
      {showShop && (
      <Chip
        chip={{ id: 'shop', icon: '🛒', label: 'Loja', count: 1, tone: NEON.gold, noBadge: true }}
        size={size}
        onPress={onShop}
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  chip: {
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  glow: { borderRadius: 18 },
  label: { color: '#e2e8f0', fontWeight: '800', marginTop: 1, letterSpacing: 0.3 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b1022',
  },
  badgeText: { color: '#0b1022', fontSize: 11, fontWeight: '900' },
});
