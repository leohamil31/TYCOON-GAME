import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BLOCK_COLORS } from '../constants';
import { glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { Grid, PlayerView } from '../types';
import { AnimatedIcon } from './AnimatedIcon';
import { Odometer } from './Odometer';

const ROW_H = 46;
const MINI = 4;

export const MiniBoard = memo(function MiniBoard({ grid, cell = MINI }: { grid: Grid | null; cell?: number }) {
  return (
    <View style={[styles.mini, { minWidth: cell * 10, minHeight: cell * 10 }]}>
      {(grid ?? []).map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((v, c) => (
            <View
              key={c}
              style={{ width: cell, height: cell, backgroundColor: v === null ? 'rgba(255,255,255,0.06)' : BLOCK_COLORS[v] }}
            />
          ))}
        </View>
      ))}
    </View>
  );
});

interface Entry {
  key: 'me' | 'opp';
  player: PlayerView | null;
  fallbackName: string;
}

function ScoreRow({ entry, rank, leading }: { entry: Entry; rank: number; leading: boolean }) {
  const y = useRef(new Animated.Value(rank * ROW_H)).current;

  useEffect(() => {
    Animated.spring(y, { toValue: rank * ROW_H, friction: 7, tension: 90, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [rank, y]);

  const p = entry.player;
  const mine = entry.key === 'me';
  return (
    <Animated.View
      style={[
        styles.row,
        leading && styles.leading,
        mine && styles.mine,
        { transform: [{ translateY: y }] },
      ]}
    >
      <View style={styles.crown}>{leading ? <AnimatedIcon glyph="👑" size={18} motion="float" speed={1400} /> : <Text style={styles.dot}>•</Text>}</View>
      <View style={styles.nameCol}>
        <Text style={[styles.name, leading && { color: NEON.gold }]} numberOfLines={1}>
          {p?.name || entry.fallbackName}
          {mine ? ' (você)' : ''}
        </Text>
        <Text style={styles.sub}>{p?.over ? '❌ sem jogadas' : p && p.combo >= 2 ? `🔥 combo x${p.combo}` : ' '}</Text>
      </View>
      <MiniBoard grid={p?.grid ?? null} />
      <View style={styles.score}>
        <Odometer value={p?.score ?? 0} fontSize={22} color={leading ? NEON.gold : '#e2e8f0'} glow={leading ? 'rgba(250,204,21,0.7)' : undefined} />
      </View>
    </Animated.View>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  me: PlayerView;
  opp: PlayerView | null;
  timeLeft: number;
}

/** Live battle scoreboard: rows swap places (spring) when the lead changes. */
export function LiveScoreboard({ me, opp, timeLeft }: Props) {
  const entries: Entry[] = [
    { key: 'me', player: me, fallbackName: 'Você' },
    { key: 'opp', player: opp, fallbackName: 'Amigo' },
  ];
  const oppAhead = (opp?.score ?? 0) > me.score;
  const rankOf = (k: 'me' | 'opp') => (k === 'me' ? (oppAhead ? 1 : 0) : oppAhead ? 0 : 1);
  const tie = (opp?.score ?? 0) === me.score;

  const urgent = timeLeft <= 10;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!urgent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [urgent, pulse]);

  return (
    <View style={[styles.card, glass]}>
      <View style={styles.head}>
        <Text style={styles.title}>⚔️ BATALHA</Text>
        <Animated.View style={[styles.timer, urgent && styles.timerUrgent, { transform: [{ scale: pulse }] }]}>
          <Text style={[styles.timerText, urgent && { color: '#fecaca' }]}>⏱ {fmt(timeLeft)}</Text>
        </Animated.View>
      </View>
      <View style={{ height: ROW_H * 2 }}>
        {entries.map((e) => (
          <ScoreRow key={e.key} entry={e} rank={rankOf(e.key)} leading={!tie && rankOf(e.key) === 0} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', marginHorizontal: 12, marginBottom: 10, borderRadius: 18, padding: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4 },
  title: { color: '#e2e8f0', fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  timer: { backgroundColor: 'rgba(148,163,184,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  timerUrgent: { backgroundColor: 'rgba(239,68,68,0.45)' },
  timerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '800' },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H - 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  leading: { borderColor: 'rgba(250,204,21,0.6)', backgroundColor: 'rgba(250,204,21,0.1)' },
  mine: { borderLeftColor: NEON.cyan, borderLeftWidth: 3 },
  crown: { width: 26, alignItems: 'center' },
  dot: { color: '#475569' },
  nameCol: { flex: 1, marginRight: 6 },
  name: { color: '#f1f5f9', fontSize: 13, fontWeight: '800' },
  sub: { color: '#94a3b8', fontSize: 10 },
  mini: { width: MINI * 10, height: MINI * 10, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)', marginRight: 10 },
  score: { minWidth: 70, alignItems: 'flex-end' },
});
