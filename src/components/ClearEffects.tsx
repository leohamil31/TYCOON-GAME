import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BLOCK_COLORS } from '../constants';
import { USE_NATIVE_DRIVER } from '../theme';
import type { ClearFx, PlacedFx } from '../types';

const native = USE_NATIVE_DRIVER;

const praise = (fx: ClearFx): string => {
  if (fx.kind === 'bomb') return 'BUM!';
  if (fx.perfect) return 'PERFEITO!';
  if (fx.lines >= 4) return 'LENDÁRIO!';
  if (fx.lines === 3) return 'INCRÍVEL!';
  if (fx.lines === 2) return 'ÓTIMO!';
  return fx.combo >= 3 ? 'EM CHAMAS!' : 'BOM!';
};

const praiseColor = (fx: ClearFx) =>
  fx.kind === 'bomb' ? '#fb923c' : fx.perfect ? '#f0abfc' : fx.lines >= 3 ? '#facc15' : fx.combo >= 2 ? '#fde047' : '#ffffff';

interface Props {
  fx: ClearFx | null;
  cell: number;
  boardSize: number;
}

/** Explosão das casas limpas + feixes nas linhas + faíscas + faixa de elogio. Remonta a cada efeito novo. */
export function ClearEffects({ fx, cell, boardSize }: Props) {
  if (!fx) return null;
  return <Effects key={fx.id} fx={fx} cell={cell} boardSize={boardSize} />;
}

const rnd = (n: number) => {
  const x = Math.sin(n * 91.345 + 12.7) * 43758.5453;
  return x - Math.floor(x);
};

function Effects({ fx, cell, boardSize }: { fx: ClearFx; cell: number; boardSize: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const beam = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(beam, { toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(banner, { toValue: 1, duration: 1250, easing: Easing.out(Easing.quad), useNativeDriver: native }),
    ]).start();
  }, [t, beam, banner]);

  const bomb = fx.kind === 'bomb';
  const hot = fx.combo >= 2;
  const center = boardSize / 2;
  // Faíscas: no máximo ~60 para não pesar em aparelhos simples.
  const sparkEvery = Math.max(1, Math.ceil(fx.cleared.length / 30));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: boardSize, height: boardSize }]}>
      {/* Feixes de luz nas linhas e colunas completas */}
      {fx.rows.map((r) => (
        <Animated.View
          key={`r${r}`}
          style={[
            styles.beam,
            {
              left: 0,
              width: boardSize,
              top: r * cell,
              height: cell,
              opacity: beam.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.95, 0] }),
              transform: [{ scaleY: beam.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.3, 0.1] }) }],
            },
          ]}
        />
      ))}
      {fx.cols.map((c) => (
        <Animated.View
          key={`c${c}`}
          style={[
            styles.beam,
            {
              top: 0,
              height: boardSize,
              left: c * cell,
              width: cell,
              opacity: beam.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.95, 0] }),
              transform: [{ scaleX: beam.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.3, 0.1] }) }],
            },
          ]}
        />
      ))}

      {/* Onda de choque da bomba / do "perfeito" */}
      {(bomb || fx.perfect) && (
        <Animated.View
          style={[
            styles.ring,
            {
              left: center - cell * 2,
              top: center - cell * 2,
              width: cell * 4,
              height: cell * 4,
              borderRadius: cell * 2,
              borderColor: bomb ? '#fb923c' : '#f0abfc',
              opacity: t.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
              transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, bomb ? 3.2 : 4] }) }],
            },
          ]}
        />
      )}
      {bomb && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#fff7ed', borderRadius: 8, opacity: t.interpolate({ inputRange: [0, 0.08, 0.35], outputRange: [0, 0.55, 0], extrapolate: 'clamp' }) },
          ]}
        />
      )}

      {/* Estilhaços: cada bloco limpo voa girando e encolhe */}
      {fx.cleared.map(({ r, c, color }, i) => {
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const away = bomb ? 1.6 : 1;
        const dx = (bomb ? (cx - center) * 0.6 : (rnd(i + r * 3) - 0.5) * cell * 2.4) * away;
        const dy = (bomb ? (cy - center) * 0.6 : (rnd(i + c * 7) - 0.5) * cell * 2.4 - cell * 0.6) * away;
        const delay = fx.rows.includes(r) ? c / 40 : r / 40; // varredura ao longo da linha
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
              backgroundColor: BLOCK_COLORS[color],
              borderWidth: 2,
              borderColor: '#fff',
              opacity: t.interpolate({ inputRange: [0, delay, delay + 0.15, 1], outputRange: [1, 1, 0.95, 0], extrapolate: 'clamp' }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, dx], extrapolate: 'clamp' }) },
                { translateY: t.interpolate({ inputRange: [0, delay, 1], outputRange: [0, 0, dy], extrapolate: 'clamp' }) },
                { scale: t.interpolate({ inputRange: [0, delay + 0.12, 1], outputRange: [1, 1.25, 0.1], extrapolate: 'clamp' }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(rnd(i) - 0.5) * 540}deg`] }) },
              ],
            }}
          />
        );
      })}

      {/* Faíscas douradas */}
      {fx.cleared
        .filter((_, i) => i % sparkEvery === 0)
        .map(({ r, c, color }, i) => {
          const ang = rnd(i * 5 + r) * Math.PI * 2;
          const dist = cell * (1.5 + rnd(i * 3 + c) * 2.5);
          const s = 3 + rnd(i) * 4;
          return (
            <Animated.View
              key={`s${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * cell + cell / 2 - s / 2,
                top: r * cell + cell / 2 - s / 2,
                width: s,
                height: s,
                borderRadius: s,
                backgroundColor: i % 2 ? '#fde68a' : BLOCK_COLORS[color],
                opacity: t.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * dist] }) },
                  { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * dist + cell] }) },
                ],
              }}
            />
          );
        })}

      {/* Faixa de elogio + combo + pontos */}
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: banner.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: banner.interpolate({ inputRange: [0, 1], outputRange: [16, -46] }) },
              { scale: banner.interpolate({ inputRange: [0, 0.12, 0.26, 1], outputRange: [0.3, 1.35, 1, 1] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.praise, { color: praiseColor(fx), fontSize: Math.min(44, boardSize * 0.11) }]}>{praise(fx)}</Text>
        {hot && !bomb && <Text style={styles.combo}>🔥 COMBO x{fx.combo}</Text>}
        {fx.points > 0 && (
          <Text style={styles.points}>
            +{fx.points}
            {fx.boosted ? '  ⚡x2' : ''}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

/** "+N" que sobe do ponto onde a peça foi encaixada (jogadas sem limpar linha). */
export function FloatScore({ placed, cell }: { placed: PlacedFx | null; cell: number }) {
  if (!placed || placed.points <= 0) return null;
  return <FloatImpl key={placed.id} placed={placed} cell={cell} />;
}

function FloatImpl({ placed, cell }: { placed: PlacedFx; cell: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [v]);
  const n = placed.cells.length;
  const cy = placed.cells.reduce((a, [r]) => a + r, 0) / n;
  const cx = placed.cells.reduce((a, [, c]) => a + c, 0) / n;
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.float,
        {
          left: cx * cell + cell / 2 - 40,
          top: cy * cell,
          opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 1.4] }) }],
        },
      ]}
    >
      +{placed.points}
    </Animated.Text>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 };

const styles = StyleSheet.create({
  beam: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 6, shadowColor: '#fff', shadowOpacity: 1, shadowRadius: 16 },
  ring: { position: 'absolute', borderWidth: 6 },
  banner: { position: 'absolute', left: 0, right: 0, top: '32%', alignItems: 'center' },
  praise: { fontWeight: '900', letterSpacing: 2, ...shadow },
  combo: { color: '#fb923c', fontSize: 22, fontWeight: '900', marginTop: 2, ...shadow },
  points: { color: '#7dd3fc', fontSize: 24, fontWeight: '900', ...shadow },
  float: { position: 'absolute', width: 80, textAlign: 'center', color: '#e0f2fe', fontSize: 18, fontWeight: '900', ...shadow },
});
