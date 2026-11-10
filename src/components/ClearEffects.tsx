import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { BLOCK_COLORS } from '../constants';
import type { ClearFx } from '../types';

const native = Platform.OS !== 'web';

const praise = (fx: ClearFx): string => {
  if (fx.perfect) return 'PERFEITO!';
  if (fx.lines >= 4) return 'LENDÁRIO!';
  if (fx.lines === 3) return 'INCRÍVEL!';
  if (fx.lines === 2) return 'ÓTIMO!';
  return 'BOM!';
};

interface Props {
  fx: ClearFx | null;
  cell: number;
  boardSize: number;
}

/** Burst of the cleared blocks + floating combo banner. Remounts on each new effect id. */
export function ClearEffects({ fx, cell, boardSize }: Props) {
  if (!fx) return null;
  return <Effects key={fx.id} fx={fx} cell={cell} boardSize={boardSize} />;
}

function Effects({ fx, cell, boardSize }: { fx: ClearFx; cell: number; boardSize: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(t, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }),
      Animated.timing(banner, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: native,
      }),
    ]).start();
  }, [t, banner]);

  const hot = fx.combo >= 2;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: boardSize, height: boardSize }]}>
      {fx.cleared.map(({ r, c, color }) => {
        // Deterministic pseudo-random spread per cell
        const dx = (((r * 7 + c * 13) % 9) - 4) * 9;
        const dy = (((r * 11 + c * 5) % 9) - 4) * 9;
        return (
          <Animated.View
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: c * cell + 2,
              top: r * cell + 2,
              width: cell - 4,
              height: cell - 4,
              borderRadius: cell * 0.22,
              backgroundColor: '#fff',
              borderWidth: 3,
              borderColor: BLOCK_COLORS[color],
              opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0.95, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
                { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.25, 0.2] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${dx * 3}deg`] }) },
              ],
            }}
          />
        );
      })}

      <Animated.View
        style={[
          styles.banner,
          {
            opacity: banner.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: banner.interpolate({ inputRange: [0, 1], outputRange: [10, -40] }) },
              { scale: banner.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0.4, 1.3, 1, 1] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.praise, hot && styles.praiseHot]}>{praise(fx)}</Text>
        {hot && <Text style={styles.combo}>COMBO x{fx.combo}</Text>}
        <Text style={styles.points}>+{fx.points}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '34%',
    alignItems: 'center',
  },
  praise: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  praiseHot: { color: '#facc15' },
  combo: {
    color: '#f97316',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  points: {
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
