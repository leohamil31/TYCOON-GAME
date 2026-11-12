import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { BattleResult } from '../types';
import { AnimatedIcon } from './AnimatedIcon';
import { Confetti } from './Confetti';
import { haptic, play } from '../services/sfx';
import { GlassButton } from './GlassButton';
import { Odometer } from './Odometer';

export function CountdownOverlay({ count, oppName }: { count: number; oppName: string }) {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: USE_NATIVE_DRIVER }).start();
    play(count > 0 ? 'countdown' : 'go');
    haptic(count > 0 ? 'light' : 'medium');
  }, [count, pop]);

  return (
    <View style={styles.overlay}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            borderColor: count <= 0 ? NEON.green : NEON.cyan,
            opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0], extrapolate: 'clamp' }),
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) }],
          },
        ]}
      />
      <Text style={styles.vs}>⚔️ Você vs {oppName}</Text>
      <Animated.Text
        style={[
          styles.count,
          count <= 0 && { color: NEON.green, textShadowColor: NEON.green },
          { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) }] },
        ]}
      >
        {count > 0 ? count : 'JÁ!'}
      </Animated.Text>
    </View>
  );
}

interface ResultProps {
  result: BattleResult;
  myName: string;
  oppName: string;
  canRematch: boolean;
  isHost: boolean;
  friendLeft: boolean;
  /** Moedas ganhas nesta partida. */
  coins?: number;
  onRematch: () => void;
  onExit: () => void;
}

const REASONS: Record<BattleResult['reason'], string> = {
  time: 'Fim do tempo!',
  out: 'Sem jogadas restantes!',
  left: 'Seu amigo saiu da batalha.',
};

export function ResultOverlay({ result, myName, oppName, canRematch, isHost, friendLeft, coins = 0, onRematch, onExit }: ResultProps) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
    play(result.outcome === 'win' ? 'win' : 'lose');
    haptic(result.outcome === 'win' ? [30, 50, 30, 50, 80] : 'medium');
  }, [enter, result.outcome]);

  const win = result.outcome === 'win';
  const draw = result.outcome === 'draw';
  const tone = win ? NEON.gold : draw ? NEON.cyan : '#f87171';

  return (
    <View style={styles.overlay}>
      {win && <Confetti count={50} loops={3} />}
      <Animated.View
        style={[
          styles.card,
          glass,
          { borderColor: tone, opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
        ]}
      >
        <AnimatedIcon glyph={win ? '🏆' : draw ? '🤝' : '💥'} size={54} motion={win ? 'pulse' : 'float'} speed={win ? 900 : 2000} />
        <Text style={[styles.title, { color: tone, textShadowColor: tone }]}>
          {win ? 'VITÓRIA!' : draw ? 'EMPATE' : 'DERROTA'}
        </Text>
        <Text style={styles.reason}>{REASONS[result.reason]}</Text>

        <View style={styles.scores}>
          <View style={styles.scoreCol}>
            <Text style={styles.who} numberOfLines={1}>{myName}</Text>
            <Odometer value={result.myScore} fontSize={32} color={win ? NEON.gold : '#e2e8f0'} />
          </View>
          <Text style={styles.x}>×</Text>
          <View style={styles.scoreCol}>
            <Text style={styles.who} numberOfLines={1}>{oppName}</Text>
            <Odometer value={result.oppScore} fontSize={32} color={!win && !draw ? NEON.gold : '#e2e8f0'} />
          </View>
        </View>

        {coins > 0 && <Text style={styles.coins}>🪙 +{coins} moedas</Text>}

        <View style={styles.actions}>
          {friendLeft ? (
            <Text style={styles.hint}>Seu amigo saiu da sala.</Text>
          ) : canRematch ? (
            <GlassButton title="Revanche" icon="🔁" tone={NEON.green} onPress={onRematch} compact />
          ) : (
            <Text style={styles.hint}>{isHost ? '' : 'Aguardando o anfitrião iniciar a revanche…'}</Text>
          )}
          <View style={{ height: 10 }} />
          <GlassButton title="Sair" icon="🚪" tone="#94a3b8" onPress={onExit} compact />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,6,23,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  ring: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 6 },
  vs: { color: '#cbd5e1', fontSize: 16, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  count: {
    color: NEON.cyan,
    fontSize: 120,
    fontWeight: '900',
    textShadowColor: NEON.cyan,
    textShadowRadius: 30,
    textShadowOffset: { width: 0, height: 0 },
  },
  card: { width: '100%', maxWidth: 400, borderRadius: 28, borderWidth: 2, padding: 22, alignItems: 'center' },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  reason: { color: '#94a3b8', marginTop: 4, marginBottom: 14 },
  scores: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  scoreCol: { alignItems: 'center', minWidth: 100 },
  who: { color: '#94a3b8', fontSize: 12, fontWeight: '800', marginBottom: 2, maxWidth: 110 },
  x: { color: '#475569', fontSize: 24, marginHorizontal: 10 },
  actions: { alignSelf: 'stretch' },
  hint: { color: '#94a3b8', textAlign: 'center', fontSize: 13 },
  coins: { color: NEON.gold, fontWeight: '900', fontSize: 15, marginBottom: 14, textShadowColor: 'rgba(250,204,21,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
});
