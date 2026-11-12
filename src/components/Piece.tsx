import React, { createContext, memo, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BLOCK_COLORS, GARBAGE } from '../constants';
import { pieceDims } from '../game/engine';
import { alpha, USE_NATIVE_DRIVER } from '../theme';
import type { Piece } from '../types';

const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
};

/** Skins de peças vendidas na loja. */
export type SkinId = 'skin_classic' | 'skin_neon' | 'skin_glass' | 'skin_pixel';

/** Skin equipada; o jogo inteiro (tabuleiro, bandeja, mira) lê daqui. */
export const SkinContext = createContext<string>('skin_classic');

/** Bloco de entulho (lixo enviado pelo rival): chapa de aço rebitada, igual em todas as skins. */
function GarbageBlock({ size, ghost }: { size: number; ghost?: boolean }) {
  const inner = size - 3;
  const r = Math.max(3, size * 0.16);
  const dot = Math.max(2, size * 0.1);
  const pad = inner * 0.16;
  return (
    <View
      style={{
        width: inner,
        height: inner,
        margin: 1.5,
        borderRadius: r,
        backgroundColor: '#4b5563',
        borderWidth: 1.5,
        borderTopColor: '#9ca3af',
        borderLeftColor: '#6b7280',
        borderRightColor: '#1f2937',
        borderBottomColor: '#111827',
        opacity: ghost ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      {/* faixa diagonal de "aço escovado" */}
      <View style={{ position: 'absolute', left: -inner * 0.2, top: inner * 0.38, width: inner * 1.4, height: inner * 0.14, backgroundColor: 'rgba(255,255,255,0.08)', transform: [{ rotate: '-35deg' }] }} />
      {[
        [pad, pad],
        [inner - pad - dot - 3, pad],
        [pad, inner - pad - dot - 3],
        [inner - pad - dot - 3, inner - pad - dot - 3],
      ].map(([x, y], i) => (
        <View key={i} style={{ position: 'absolute', left: x, top: y, width: dot, height: dot, borderRadius: dot, backgroundColor: '#d1d5db', borderBottomWidth: 1, borderBottomColor: '#1f2937' }} />
      ))}
    </View>
  );
}

/** Bloco com a skin equipada (ou `skin` para prévias da loja). */
export const Block = memo(function Block({
  color,
  size,
  ghost,
  skin,
}: {
  color: number;
  size: number;
  ghost?: boolean;
  skin?: string;
}) {
  const equipped = useContext(SkinContext);
  if (color === GARBAGE) return <GarbageBlock size={size} ghost={ghost} />;
  const base = BLOCK_COLORS[color];
  const kind = (skin ?? equipped) as SkinId;
  const inner = size - 3;

  if (kind === 'skin_neon') {
    // Contorno luminoso sobre fundo escuro.
    return (
      <View
        style={{
          width: inner,
          height: inner,
          margin: 1.5,
          borderRadius: size * 0.2,
          backgroundColor: shade(base, 0.22),
          borderWidth: Math.max(2, size * 0.08),
          borderColor: base,
          opacity: ghost ? 0.5 : 1,
          shadowColor: base,
          shadowOpacity: ghost ? 0 : 0.9,
          shadowRadius: size * 0.25,
          shadowOffset: { width: 0, height: 0 },
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: inner * 0.3, height: inner * 0.3, borderRadius: inner, backgroundColor: base, opacity: 0.85 }} />
      </View>
    );
  }

  if (kind === 'skin_glass') {
    // Vidro colorido translúcido com reflexo.
    return (
      <View
        style={{
          width: inner,
          height: inner,
          margin: 1.5,
          borderRadius: size * 0.26,
          backgroundColor: alpha(base, ghost ? 0.25 : 0.55),
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.55)',
          borderBottomColor: alpha(base, 0.9),
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', left: -inner * 0.2, top: -inner * 0.45, width: inner * 1.1, height: inner * 0.8, borderRadius: inner, backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ rotate: '-18deg' }] }} />
        <View style={{ position: 'absolute', right: inner * 0.14, bottom: inner * 0.14, width: inner * 0.16, height: inner * 0.16, borderRadius: inner, backgroundColor: 'rgba(255,255,255,0.6)' }} />
      </View>
    );
  }

  if (kind === 'skin_pixel') {
    // Retrô 8-bit: quadrado com bordas claras/escuras chapadas.
    const b = Math.max(2, Math.round(size * 0.12));
    return (
      <View
        style={{
          width: inner,
          height: inner,
          margin: 1.5,
          backgroundColor: base,
          borderTopWidth: b,
          borderLeftWidth: b,
          borderRightWidth: b,
          borderBottomWidth: b,
          borderTopColor: shade(base, 1.35),
          borderLeftColor: shade(base, 1.2),
          borderRightColor: shade(base, 0.7),
          borderBottomColor: shade(base, 0.55),
          opacity: ghost ? 0.5 : 1,
        }}
      >
        <View style={{ position: 'absolute', left: b * 0.5, top: b * 0.5, width: b, height: b, backgroundColor: 'rgba(255,255,255,0.7)' }} />
      </View>
    );
  }

  return <CubeBlock base={base} size={size} ghost={ghost} />;
});

/** Skin clássica: cubo 3D com face lateral escura, topo iluminado, chanfro e brilho. */
function CubeBlock({ base, size, ghost }: { base: string; size: number; ghost?: boolean }) {
  const inner = size - 3;
  const radius = Math.max(4, size * 0.24);
  const depth = Math.max(3, size * 0.16);
  const top = inner - depth;

  return (
    <View
      style={{
        width: inner,
        height: inner,
        margin: 1.5,
        borderRadius: radius,
        backgroundColor: shade(base, 0.5),
        opacity: ghost ? 0.5 : 1,
        borderWidth: ghost ? 2 : 0,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: ghost ? 0 : 0.45,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: depth * 0.8 },
        elevation: ghost ? 0 : 3,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: top,
          borderRadius: radius,
          backgroundColor: base,
          borderTopWidth: 2,
          borderLeftWidth: 1.5,
          borderTopColor: 'rgba(255,255,255,0.6)',
          borderLeftColor: 'rgba(255,255,255,0.35)',
          borderBottomWidth: 2,
          borderRightWidth: 1.5,
          borderBottomColor: 'rgba(0,0,0,0.22)',
          borderRightColor: 'rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: top * 0.2,
            right: top * 0.2,
            top: top * 0.2,
            bottom: top * 0.2,
            borderRadius: radius * 0.6,
            backgroundColor: shade(base, 1.12),
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: top * 0.1,
            left: top * 0.14,
            width: top * 0.55,
            height: top * 0.16,
            borderRadius: top * 0.08,
            backgroundColor: 'rgba(255,255,255,0.55)',
          }}
        />
      </View>
    </View>
  );
}

/** Casa recém-encaixada: entra com "pop" elástico e um brilho branco que se apaga. */
export function PopIn({ size, delay = 0, children }: { size: number; delay?: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, friction: 6, tension: 380, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
      }}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 2,
          top: 2,
          right: 2,
          bottom: 2,
          borderRadius: size * 0.24,
          backgroundColor: '#fff',
          opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.85, 0.35, 0] }),
        }}
      />
    </Animated.View>
  );
}

/** Peça da bandeja: entra girando/escalando quando chega uma mão nova; flutua quando selecionada. */
export function TrayPiece({
  piece,
  size,
  index,
  selected,
  hidden,
  dim,
}: {
  piece: Piece;
  size: number;
  index: number;
  selected: boolean;
  hidden: boolean;
  dim: boolean;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.sequence([
      Animated.delay(index * 40),
      Animated.spring(enter, { toValue: 1, friction: 7, tension: 280, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [piece.id, index, enter]);

  useEffect(() => {
    if (!selected) {
      Animated.spring(lift, { toValue: 0, friction: 6, useNativeDriver: USE_NATIVE_DRIVER }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(lift, { toValue: 0.55, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [selected, lift]);

  return (
    <Animated.View
      style={{
        opacity: hidden ? 0.15 : dim ? 0.38 : 1,
        transform: [
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
          { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
          { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
        ],
      }}
    >
      <PieceView piece={piece} size={size} />
    </Animated.View>
  );
}

export function PieceView({ piece, size, skin }: { piece: Piece; size: number; skin?: string }) {
  const { rows, cols } = pieceDims(piece);
  const filled = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
  return (
    <View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: cols }, (_, c) =>
            filled.has(`${r},${c}`) ? (
              <Block key={c} color={piece.color} size={size} skin={skin} />
            ) : (
              <View key={c} style={{ width: size, height: size }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
