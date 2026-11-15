import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { Icon } from './icons/Icon';
import { GlassSurface } from './GlassSurface';
import { Odometer } from './Odometer';

interface Props {
  score: number;
  best: number;
  combo: number;
  /** Saldo de moedas exibido no HUD. */
  coins?: number;
  onBack: () => void;
  /** Hides the combo chip's idle text to save space. */
  title?: string;
  /** Telas baixas: menos margem e altura (sobra espaço para a arena). */
  compact?: boolean;
}

/** Top HUD: back button, rolling score, combo chip and the record with an animated trophy. */
export function ScoreHud({ score, best, combo, coins, onBack, title = 'TYCOON GAME', compact }: Props) {
  // Record to beat = best at the start of the current game (resets when score is 0).
  const base = useRef(best);
  if (score === 0) base.current = best;
  const beaten = base.current > 0 && score > base.current;
  // "Pulo" do placar a cada ponto ganho (maior em jogadas grandes).
  const pop = useRef(new Animated.Value(1)).current;
  const lastScore = useRef(score);
  useEffect(() => {
    const gain = score - lastScore.current;
    lastScore.current = score;
    if (gain <= 0) return;
    pop.setValue(gain >= 90 ? 1.3 : gain >= 30 ? 1.18 : 1.08);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 260, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [score, pop]);

  const chip = useRef(new Animated.Value(1)).current;
  const banner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (combo < 2) return;
    chip.setValue(1.35);
    Animated.spring(chip, { toValue: 1, friction: 3, tension: 180, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [combo, chip]);

  useEffect(() => {
    Animated.timing(banner, { toValue: beaten ? 1 : 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [beaten, banner]);

  const shownBest = Math.max(best, score);

  return (
    <GlassSurface radius={22} style={[styles.wrap, compact && styles.compact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao menu" onPress={onBack} style={styles.back}>
        <Icon name="back" size={22} color="#e2e8f0" stroke={2.6} />
      </Pressable>

      <View style={styles.block}>
        <Text style={styles.label}>PONTOS</Text>
        <Animated.View style={{ transform: [{ scale: pop }], alignSelf: 'flex-start' }}>
          <Odometer value={score} fontSize={34} glow="rgba(125,211,252,0.7)" />
        </Animated.View>
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {combo >= 2 ? (
          <Animated.View style={[styles.chip, styles.chipOn, { transform: [{ scale: chip }] }]}>
            <Text style={[styles.chipText, styles.chipTextOn]} numberOfLines={1}>
              🔥 COMBO x{combo}
            </Text>
          </Animated.View>
        ) : coins !== undefined ? (
          <View style={[styles.chip, styles.coinChip]}>
            <Text style={styles.coins} numberOfLines={1}>
              🪙 {coins}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.block, styles.right]}>
        <View style={styles.recordRow}>
          <AnimatedIcon glyph="trophy" color={NEON.gold} glow size={18} motion={beaten ? 'pulse' : 'float'} speed={beaten ? 700 : 2600} />
          <Text style={[styles.label, { marginLeft: 4 }]}>RECORDE</Text>
        </View>
        <Odometer value={shownBest} fontSize={22} color={NEON.gold} glow={beaten ? 'rgba(250,204,21,0.9)' : undefined} />
        <Animated.Text
          style={[
            styles.newRecord,
            { opacity: banner, transform: [{ scale: banner.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          ⭐ NOVO!
        </Animated.Text>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 64,
  },
  compact: { marginTop: 4, marginBottom: 6, paddingVertical: 4, minHeight: 56 },
  coins: { color: NEON.gold, fontSize: 12, fontWeight: '900' },
  coinChip: { backgroundColor: 'rgba(250,204,21,0.12)', borderWidth: 1, borderColor: 'rgba(250,204,21,0.35)' },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  backText: { color: '#e2e8f0', fontSize: 26, lineHeight: 28, fontWeight: '700' },
  block: { flex: 1.1 },
  right: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  label: { color: '#94a3b8', fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  title: { color: NEON.cyan, fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  chip: {
    marginTop: 6,
    backgroundColor: 'rgba(148,163,184,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipOn: { backgroundColor: 'rgba(249,115,22,0.3)' },
  chipText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: '#fdba74' },
  newRecord: { position: 'absolute', right: 0, bottom: -8, color: NEON.gold, fontSize: 10, fontWeight: '900' },
});
