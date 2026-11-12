import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GAME } from '../constants';
import { area3, clampAim } from '../game/engine';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { Grid } from '../types';
import { Block } from './Piece';

const N = GAME.GRID_SIZE;

export type AimMode = 'blast' | 'rubble';

interface Props {
  visible: boolean;
  /** Tabuleiro mirado (o seu, para a bomba; o do adversário, para o entulho). */
  grid: Grid | null;
  mode: AimMode;
  title: string;
  onConfirm: (r: number, c: number) => void;
  onCancel: () => void;
}

/** Quantas casas a mira afeta: blocos destruídos (bomba) ou casas vazias que viram entulho. */
const affected = (grid: Grid, mode: AimMode, r: number, c: number) =>
  area3(r, c).filter(([rr, cc]) => (mode === 'blast' ? grid[rr][cc] !== null : grid[rr][cc] === null)).length;

/** Melhor ponto inicial da mira: onde a bomba destrói mais / o entulho atrapalha mais. */
const bestSpot = (grid: Grid, mode: AimMode) => {
  let best = { r: 4, c: 4, n: -1 };
  for (let r = 1; r < N - 1; r++)
    for (let c = 1; c < N - 1; c++) {
      const n = affected(grid, mode, r, c);
      if (n > best.n) best = { r, c, n };
    }
  return { r: best.r, c: best.c };
};

/** Modo de mira: toque ou arraste sobre o tabuleiro para posicionar a área 3x3 e confirme. */
export function AimBoard({ visible, grid, mode, title, onConfirm, onCancel }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.floor(Math.min(width - 56, height - 260, 380));
  const cell = size / N;
  const [aim, setAim] = useState({ r: 4, c: 4 });
  const pulse = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const boardRef = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const tone = mode === 'blast' ? '#fb923c' : NEON.violet;

  useEffect(() => {
    if (!visible || !grid) return;
    setAim(bestSpot(grid, mode));
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 220, useNativeDriver: USE_NATIVE_DRIVER }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // A mira inicial só é calculada ao abrir; depois o jogador controla.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveTo = (pageX: number, pageY: number) =>
    setAim(clampAim((pageY - origin.current.y) / cell - 0.5, (pageX - origin.current.x) / cell - 0.5));

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
          const { pageX, pageY } = e.nativeEvent;
          boardRef.current?.measureInWindow((x: number, y: number) => {
            origin.current = { x, y };
            moveTo(pageX, pageY);
          });
        },
        onPanResponderMove: (_e: unknown, g: { moveX: number; moveY: number }) => moveTo(g.moveX, g.moveY),
      }),
    [cell], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!visible || !grid) return null;
  const zone = new Set(area3(aim.r, aim.c).map(([r, c]) => `${r},${c}`));
  const count = affected(grid, mode, aim.r, aim.c);
  const label =
    mode === 'blast'
      ? count > 0
        ? `Destrói ${count} bloco${count > 1 ? 's' : ''} · +${count * 2} pts`
        : 'Nenhum bloco nessa área'
      : count > 0
        ? `Coloca ${count} entulho${count > 1 ? 's' : ''} no rival`
        : 'Área já está cheia — mire em casas vazias';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            glassStrong,
            {
              borderColor: alpha(tone, 0.7),
              opacity: enter,
              transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <Text style={[styles.title, { textShadowColor: tone }]}>{title}</Text>
          <Text style={styles.sub}>Toque ou arraste para mirar</Text>

          <View ref={boardRef} collapsable={false} style={[styles.board, { width: size, height: size }]} {...responder.panHandlers}>
            {grid.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row' }} pointerEvents="none">
                {row.map((v, c) => {
                  const inZone = zone.has(`${r},${c}`);
                  return (
                    <View key={c} style={{ width: cell, height: cell }}>
                      <View style={[styles.slot, { borderRadius: cell * 0.2 }]} />
                      {v !== null && <Block color={v} size={cell} />}
                      {inZone && (
                        <Animated.View
                          style={[
                            styles.zone,
                            {
                              borderRadius: cell * 0.22,
                              borderColor: tone,
                              backgroundColor: alpha(tone, v !== null ? (mode === 'blast' ? 0.45 : 0.12) : mode === 'rubble' ? 0.4 : 0.1),
                              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                            },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
            {/* Retícula da mira */}
            <View
              pointerEvents="none"
              style={[
                styles.reticle,
                {
                  left: (aim.c - 1) * cell - 3,
                  top: (aim.r - 1) * cell - 3,
                  width: cell * 3 + 6,
                  height: cell * 3 + 6,
                  borderRadius: cell * 0.5,
                  borderColor: tone,
                  shadowColor: tone,
                },
              ]}
            >
              <View style={[styles.crossH, { backgroundColor: tone }]} />
              <View style={[styles.crossV, { backgroundColor: tone }]} />
            </View>
          </View>

          <Text style={[styles.info, { color: count > 0 ? '#fff' : '#94a3b8' }]}>{label}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.btn, styles.cancel]}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={count === 0}
              onPress={() => onConfirm(aim.r, aim.c)}
              style={[styles.btn, { backgroundColor: tone, opacity: count === 0 ? 0.4 : 1 }]}
            >
              <Text style={styles.fireText}>{mode === 'blast' ? '💣 Explodir' : '💥 Lançar'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.82)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { borderRadius: 26, borderWidth: 2, padding: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1.5, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } },
  sub: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 12 },
  board: { backgroundColor: '#0b1324', borderRadius: 14, overflow: 'visible' },
  slot: { position: 'absolute', left: 1.5, top: 1.5, right: 1.5, bottom: 1.5, backgroundColor: 'rgba(148,163,184,0.08)' },
  zone: { position: 'absolute', left: 1, top: 1, right: 1, bottom: 1, borderWidth: 2 },
  reticle: { position: 'absolute', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.9, shadowRadius: 12 },
  crossH: { position: 'absolute', width: 18, height: 2, borderRadius: 1 },
  crossV: { position: 'absolute', width: 2, height: 18, borderRadius: 1 },
  info: { fontSize: 14, fontWeight: '800', marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  cancel: { backgroundColor: 'rgba(148,163,184,0.18)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.4)' },
  cancelText: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  fireText: { color: '#0b1022', fontWeight: '900', fontSize: 15 },
});
