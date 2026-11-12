import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BLOCK_COLORS } from '../constants';
import { USE_NATIVE_DRIVER } from '../theme';
import type { ClearFx, PlacedFx } from '../types';

const native = USE_NATIVE_DRIVER;

/** Estilos de limpeza vendidos na loja (efeitos de partículas). */
export type FxStyle = 'fx_classic' | 'fx_stars' | 'fx_pixel' | 'fx_bubbles';

const praise = (fx: ClearFx): string => {
  if (fx.perfect) return 'PERFEITO!';
  if (fx.lines >= 4) return 'LENDÁRIO!';
  if (fx.lines === 3) return 'INCRÍVEL!';
  if (fx.lines === 2) return 'ÓTIMO!';
  return fx.combo >= 3 ? 'EM CHAMAS!' : 'BOM!';
};

const praiseColor = (fx: ClearFx) =>
  fx.perfect ? '#f0abfc' : fx.lines >= 3 ? '#facc15' : fx.combo >= 2 ? '#fde047' : '#ffffff';

interface Props {
  fx: ClearFx | null;
  cell: number;
  boardSize: number;
  /** Efeito de limpeza equipado. */
  fxStyle?: string;
}

/** Efeitos do tabuleiro. Remonta a cada efeito novo (um único Animated.Value por efeito = leve). */
export function ClearEffects({ fx, cell, boardSize, fxStyle = 'fx_classic' }: Props) {
  if (!fx) return null;
  if (fx.kind === 'bomb' || fx.kind === 'rubble') return <Explosion key={fx.id} fx={fx} cell={cell} boardSize={boardSize} />;
  return <LineClear key={fx.id} fx={fx} cell={cell} boardSize={boardSize} fxStyle={fxStyle as FxStyle} />;
}

const rnd = (n: number) => {
  const x = Math.sin(n * 91.345 + 12.7) * 43758.5453;
  return x - Math.floor(x);
};

// ===================================================================== explosão (bomba / entulho)
/**
 * Explosão limpa: brilho focado no centro, duas ondas de choque finas e cada bloco atingido se parte
 * em 4 fragmentos que se afastam do centro. Sem chuva de partículas, sem flash na tela inteira.
 */
function Explosion({ fx, cell, boardSize }: { fx: ClearFx; cell: number; boardSize: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const label = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.sequence([
        Animated.delay(50),
        Animated.timing(label, { toValue: 1, duration: 560, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      ]),
    ]).start();
  }, [t, label]);

  const rubble = fx.kind === 'rubble';
  const tone = rubble ? '#a78bfa' : '#fb923c';
  const c0 = fx.center ?? { r: 4.5, c: 4.5 };
  const cx = c0.c * cell + cell / 2;
  const cy = c0.r * cell + cell / 2;
  const glow = cell * 3.2;

  const ring = (delay: number, maxScale: number, width: number, key: string) => (
    <Animated.View
      key={key}
      style={{
        position: 'absolute',
        left: cx - cell * 1.5,
        top: cy - cell * 1.5,
        width: cell * 3,
        height: cell * 3,
        borderRadius: cell * 1.5,
        borderWidth: width,
        borderColor: tone,
        opacity: t.interpolate({ inputRange: [0, delay, delay + 0.08, 1], outputRange: [0, 0, 0.9, 0], extrapolate: 'clamp' }),
        transform: [{ scale: t.interpolate({ inputRange: [0, delay, 1], outputRange: [0.3, 0.3, maxScale], extrapolate: 'clamp' }) }],
      }}
    />
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: boardSize, height: boardSize, overflow: 'visible' }]}>
      {/* Brilho focado: 3 discos concêntricos imitam um gradiente radial */}
      {[1, 0.66, 0.36].map((k, i) => (
        <Animated.View
          key={`g${i}`}
          style={{
            position: 'absolute',
            left: cx - (glow * k) / 2,
            top: cy - (glow * k) / 2,
            width: glow * k,
            height: glow * k,
            borderRadius: (glow * k) / 2,
            backgroundColor: i === 2 ? '#fff7ed' : tone,
            opacity: t.interpolate({ inputRange: [0, 0.06, 0.45], outputRange: [0, i === 2 ? 0.95 : 0.22 + i * 0.12, 0], extrapolate: 'clamp' }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1.05, 1.25] }) }],
          }}
        />
      ))}
      {ring(0, 2.6, 3, 'r1')}
      {ring(0.12, 3.4, 1.5, 'r2')}

      {/* Estilhaços: cada bloco atingido vira 4 fragmentos */}
      {fx.cleared.map(({ r, c, color }, i) =>
        [0, 1, 2, 3].map((q) => {
          const half = (cell - 4) / 2;
          const fx0 = c * cell + 2 + (q % 2) * half;
          const fy0 = r * cell + 2 + Math.floor(q / 2) * half;
          // direção: do centro da explosão para o fragmento (+ leve variação)
          const vx = fx0 + half / 2 - cx + (rnd(i * 4 + q) - 0.5) * cell * 0.4;
          const vy = fy0 + half / 2 - cy + (rnd(i * 7 + q) - 0.5) * cell * 0.4;
          const len = Math.max(1, Math.hypot(vx, vy));
          const dist = cell * (0.9 + rnd(i + q * 3) * 0.7);
          return (
            <Animated.View
              key={`${r}-${c}-${q}`}
              style={{
                position: 'absolute',
                left: fx0,
                top: fy0,
                width: half,
                height: half,
                borderRadius: half * 0.3,
                backgroundColor: BLOCK_COLORS[color],
                borderTopWidth: 1.5,
                borderTopColor: 'rgba(255,255,255,0.55)',
                opacity: t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.85, 0] }),
                transform: [
                  { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, (vx / len) * dist] }) },
                  { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, (vy / len) * dist + cell * 0.25] }) },
                  { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(rnd(i + q) - 0.5) * 70}deg`] }) },
                  { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
                ],
              }}
            />
          );
        }),
      )}

      {(fx.points > 0 || rubble) && (
        <Animated.Text
          style={[
            styles.blastLabel,
            {
              left: cx - 70,
              top: cy - cell * 0.8,
              color: rubble ? '#ddd6fe' : '#fed7aa',
              opacity: label.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: label.interpolate({ inputRange: [0, 1], outputRange: [0, -cell * 1.3] }) },
                { scale: label.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.1, 1] }) },
              ],
            },
          ]}
        >
          {rubble ? 'ENTULHO!' : `+${fx.points}`}
        </Animated.Text>
      )}
    </View>
  );
}

// ===================================================================== linhas completas
function LineClear({ fx, cell, boardSize, fxStyle }: { fx: ClearFx; cell: number; boardSize: number; fxStyle: FxStyle }) {
  const t = useRef(new Animated.Value(0)).current;
  const beam = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.timing(beam, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(banner, { toValue: 1, duration: 760, easing: Easing.out(Easing.quad), useNativeDriver: native }),
    ]).start();
  }, [t, beam, banner]);

  const hot = fx.combo >= 2;
  const beamOpacity = beam.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] });

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
              opacity: beamOpacity,
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
              opacity: beamOpacity,
              transform: [{ scaleX: beam.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.3, 0.1] }) }],
            },
          ]}
        />
      ))}

      {fx.perfect && (
        <Animated.View
          style={[
            styles.ring,
            {
              left: boardSize / 2 - cell * 2,
              top: boardSize / 2 - cell * 2,
              width: cell * 4,
              height: cell * 4,
              borderRadius: cell * 2,
              opacity: t.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
              transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 4] }) }],
            },
          ]}
        />
      )}

      {fx.cleared.map(({ r, c, color }, i) => (
        <Particle key={`${r}-${c}`} t={t} r={r} c={c} i={i} color={color} cell={cell} style={fxStyle} sweep={fx.rows.includes(r) ? c / 70 : r / 70} />
      ))}

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
        {hot && <Text style={styles.combo}>🔥 COMBO x{fx.combo}</Text>}
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

/** Uma partícula por bloco limpo, com o visual do efeito equipado. */
function Particle({
  t,
  r,
  c,
  i,
  color,
  cell,
  style,
  sweep,
}: {
  t: Animated.Value;
  r: number;
  c: number;
  i: number;
  color: number;
  cell: number;
  style: FxStyle;
  sweep: number;
}) {
  const base = BLOCK_COLORS[color];
  const opacity = t.interpolate({ inputRange: [0, sweep, sweep + 0.15, 1], outputRange: [1, 1, 0.95, 0], extrapolate: 'clamp' });

  if (style === 'fx_stars') {
    // Estrela dourada que gira e sobe.
    return (
      <Animated.Text
        style={{
          position: 'absolute',
          left: c * cell,
          top: r * cell,
          width: cell,
          height: cell,
          textAlign: 'center',
          fontSize: cell * 0.8,
          lineHeight: cell,
          color: i % 3 === 0 ? '#fde68a' : '#facc15',
          textShadowColor: 'rgba(250,204,21,0.9)',
          textShadowRadius: 8,
          opacity,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, sweep, 1], outputRange: [0, 0, -cell * (1.2 + rnd(i) * 1.2)], extrapolate: 'clamp' }) },
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, (rnd(i + 9) - 0.5) * cell * 1.4] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(rnd(i) > 0.5 ? 1 : -1) * 220}deg`] }) },
            { scale: t.interpolate({ inputRange: [0, sweep + 0.1, 1], outputRange: [0.4, 1.15, 0.5], extrapolate: 'clamp' }) },
          ],
        }}
      >
        ✦
      </Animated.Text>
    );
  }

  if (style === 'fx_pixel') {
    // Bloco se desfaz em 4 pixels que caem retos (sem rotação).
    const p = (cell - 4) / 2;
    return (
      <>
        {[0, 1, 2, 3].map((q) => (
          <Animated.View
            key={q}
            style={{
              position: 'absolute',
              left: c * cell + 2 + (q % 2) * p,
              top: r * cell + 2 + Math.floor(q / 2) * p,
              width: p - 1,
              height: p - 1,
              backgroundColor: base,
              opacity,
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, ((q % 2) - 0.5) * cell * 0.9] }) },
                { translateY: t.interpolate({ inputRange: [0, sweep, 1], outputRange: [0, 0, cell * (0.6 + Math.floor(q / 2) * 0.6)], extrapolate: 'clamp' }) },
              ],
            }}
          />
        ))}
      </>
    );
  }

  if (style === 'fx_bubbles') {
    // Bolha translúcida que flutua e estoura.
    const s = cell * 0.7;
    return (
      <Animated.View
        style={{
          position: 'absolute',
          left: c * cell + (cell - s) / 2,
          top: r * cell + (cell - s) / 2,
          width: s,
          height: s,
          borderRadius: s / 2,
          borderWidth: 2,
          borderColor: base,
          backgroundColor: 'rgba(255,255,255,0.12)',
          opacity: t.interpolate({ inputRange: [0, sweep, 0.8, 1], outputRange: [0.9, 0.9, 0.8, 0], extrapolate: 'clamp' }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -cell * (1 + rnd(i) * 1.6)] }) },
            { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, cell * 0.25, -cell * 0.1] }) },
            { scale: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.6, 1.1, 1.5] }) },
          ],
        }}
      />
    );
  }

  // fx_classic: estilhaço do bloco que gira e encolhe.
  const dx = (rnd(i + r * 3) - 0.5) * cell * 2.4;
  const dy = (rnd(i + c * 7) - 0.5) * cell * 2.4 - cell * 0.6;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: c * cell + 2,
        top: r * cell + 2,
        width: cell - 4,
        height: cell - 4,
        borderRadius: cell * 0.22,
        backgroundColor: base,
        borderWidth: 2,
        borderColor: '#fff',
        opacity,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, sweep, 1], outputRange: [0, 0, dx], extrapolate: 'clamp' }) },
          { translateY: t.interpolate({ inputRange: [0, sweep, 1], outputRange: [0, 0, dy], extrapolate: 'clamp' }) },
          { scale: t.interpolate({ inputRange: [0, sweep + 0.12, 1], outputRange: [1, 1.25, 0.1], extrapolate: 'clamp' }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(rnd(i) - 0.5) * 540}deg`] }) },
        ],
      }}
    />
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
    Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
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
  ring: { position: 'absolute', borderWidth: 5, borderColor: '#f0abfc' },
  banner: { position: 'absolute', left: 0, right: 0, top: '32%', alignItems: 'center' },
  praise: { fontWeight: '900', letterSpacing: 2, ...shadow },
  combo: { color: '#fb923c', fontSize: 22, fontWeight: '900', marginTop: 2, ...shadow },
  points: { color: '#7dd3fc', fontSize: 24, fontWeight: '900', ...shadow },
  float: { position: 'absolute', width: 80, textAlign: 'center', color: '#e0f2fe', fontSize: 18, fontWeight: '900', ...shadow },
  blastLabel: { position: 'absolute', width: 140, textAlign: 'center', fontSize: 22, fontWeight: '900', letterSpacing: 1, ...shadow },
});
