import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { PlayerView } from '../types';
import { MiniBoard } from './LiveScoreboard';
import { Odometer } from './Odometer';

interface Props {
  me: PlayerView;
  opp: PlayerView | null;
  timeLeft: number;
  /** Pontuação local (atualiza na hora, antes do eco da rede). */
  myScore: number;
  combo: number;
  coins?: number;
  onBack: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/**
 * Faixa única da batalha (~72px): você × cronômetro × rival com o mini-tabuleiro dele.
 * Substitui o HUD + placar grandes para sobrar espaço para a arena.
 */
export function BattleHud({ me, opp, timeLeft, myScore, combo, coins, onBack }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const urgent = timeLeft <= 10;
  const oppScore = opp?.score ?? 0;
  const lead = myScore - oppScore;

  useEffect(() => {
    if (!urgent) return;
    pulse.setValue(1.15);
    Animated.timing(pulse, { toValue: 1, duration: 280, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [timeLeft, urgent, pulse]);

  return (
    <View style={[styles.bar, glassStrong]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Sair da batalha" onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>

      <View style={[styles.side, lead >= 0 && styles.leading]}>
        <Text style={styles.name} numberOfLines={1}>
          {lead > 0 ? '👑 ' : ''}
          {me.name}
        </Text>
        <Odometer value={myScore} fontSize={24} color="#fff" glow={lead >= 0 ? 'rgba(250,204,21,0.6)' : undefined} />
        <Text style={styles.sub} numberOfLines={1}>
          {combo >= 2 ? `🔥 combo x${combo}` : coins !== undefined ? `🪙 ${coins}` : ' '}
        </Text>
      </View>

      <Animated.View style={[styles.timer, urgent && styles.timerUrgent, { transform: [{ scale: pulse }] }]}>
        <Text style={[styles.timerText, urgent && { color: '#fecaca' }]}>{fmt(timeLeft)}</Text>
        <Text style={styles.vs}>VS</Text>
      </Animated.View>

      <View style={[styles.side, styles.right, lead < 0 && styles.leading]}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.name} numberOfLines={1}>
            {lead < 0 ? '👑 ' : ''}
            {opp?.name ?? 'Amigo'}
          </Text>
          <Odometer value={oppScore} fontSize={24} color="#fff" glow={lead < 0 ? 'rgba(250,204,21,0.6)' : undefined} />
          <Text style={[styles.sub, opp?.over && { color: '#fca5a5' }]} numberOfLines={1}>
            {opp?.over ? 'sem jogadas' : (opp?.combo ?? 0) >= 2 ? `🔥 x${opp?.combo}` : ' '}
          </Text>
        </View>
        <View style={styles.miniWrap}>
          <MiniBoard grid={opp?.grid ?? null} cell={5} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 18,
    gap: 6,
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  backText: { color: '#e2e8f0', fontSize: 22, fontWeight: '900', marginTop: -2 },
  side: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leading: { borderColor: alpha(NEON.gold, 0.55), backgroundColor: alpha(NEON.gold, 0.08) },
  name: { color: '#cbd5e1', fontSize: 11, fontWeight: '800' },
  sub: { color: '#fdba74', fontSize: 10, fontWeight: '800' },
  timer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.45)',
  },
  timerUrgent: { borderColor: '#f87171', backgroundColor: 'rgba(127,29,29,0.6)' },
  timerText: { color: '#e0f2fe', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  vs: { color: '#64748b', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  miniWrap: { borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(148,163,184,0.3)' },
});
