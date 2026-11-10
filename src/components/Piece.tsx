import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BLOCK_COLORS } from '../constants';
import { pieceDims } from '../game/engine';
import type { Piece } from '../types';

const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
};

/** Chunky 3D cube: dark side face underneath, lit top face with bevel and gloss. */
export const Block = memo(function Block({
  color,
  size,
  ghost,
}: {
  color: number;
  size: number;
  ghost?: boolean;
}) {
  const base = BLOCK_COLORS[color];
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
        elevation: ghost ? 0 : 4,
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
});

export function PieceView({ piece, size }: { piece: Piece; size: number }) {
  const { rows, cols } = pieceDims(piece);
  const filled = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
  return (
    <View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: cols }, (_, c) =>
            filled.has(`${r},${c}`) ? (
              <Block key={c} color={piece.color} size={size} />
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
