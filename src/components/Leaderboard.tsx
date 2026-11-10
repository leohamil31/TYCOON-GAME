import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { ScoreEntry } from '../types';
import { AnimatedIcon } from './AnimatedIcon';
import { Odometer } from './Odometer';

const MEDALS = ['🥇', '🥈', '🥉'];

function Row({ entry, rank, highlight }: { entry: ScoreEntry; rank: number; highlight: boolean }) {
  const enter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 450,
      delay: rank * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    // Numbers roll up from 0 once the row has slid in.
    const t = setTimeout(() => setShown(entry.score), 200 + rank * 80);
    return () => clearTimeout(t);
  }, [enter, entry.score, rank]);

  useEffect(() => {
    if (rank !== 0 && !highlight) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(glow, { toValue: 0, duration: 1100, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rank, highlight, glow]);

  const top = rank === 0;
  return (
    <Animated.View
      style={[
        styles.row,
        top && styles.topRow,
        highlight && styles.mine,
        {
          opacity: enter,
          transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
        },
      ]}
    >
      {(top || highlight) && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: 14, backgroundColor: top ? 'rgba(250,204,21,0.18)' : 'rgba(56,189,248,0.18)', opacity: glow },
          ]}
        />
      )}
      <Text style={styles.rank}>{rank < 3 ? MEDALS[rank] : `#${rank + 1}`}</Text>
      <View style={styles.nameCol}>
        <Text style={[styles.name, top && { color: NEON.gold }]} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={styles.date}>{new Date(entry.date).toLocaleDateString('pt-BR')}</Text>
      </View>
      <Odometer value={shown} fontSize={20} color={top ? NEON.gold : '#e2e8f0'} glow={top ? 'rgba(250,204,21,0.7)' : undefined} />
    </Animated.View>
  );
}

interface Props {
  entries: ScoreEntry[];
  /** Entry id to highlight (the run that just finished). */
  highlightId?: number | null;
  limit?: number;
}

export function Leaderboard({ entries, highlightId = null, limit = 5 }: Props) {
  const list = entries.slice(0, limit);
  return (
    <View style={[styles.card, glass]}>
      <View style={styles.header}>
        <AnimatedIcon glyph="🏆" size={22} motion="float" />
        <Text style={styles.title}>PLACAR</Text>
        <AnimatedIcon glyph="✨" size={16} motion="spin" speed={5000} style={{ marginLeft: 'auto' }} />
      </View>
      {list.length === 0 ? (
        <Text style={styles.empty}>Jogue uma partida para entrar no placar!</Text>
      ) : (
        list.map((e, i) => <Row key={e.id} entry={e} rank={i} highlight={e.id === highlightId} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 14, alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 15, fontWeight: '900', letterSpacing: 4, marginLeft: 8 },
  empty: { color: '#94a3b8', textAlign: 'center', paddingVertical: 18, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  topRow: { borderWidth: 1, borderColor: 'rgba(250,204,21,0.55)' },
  mine: { borderWidth: 1, borderColor: 'rgba(56,189,248,0.7)' },
  rank: { width: 34, color: '#cbd5e1', fontSize: 18, fontWeight: '800' },
  nameCol: { flex: 1, marginRight: 8 },
  name: { color: '#f1f5f9', fontSize: 14, fontWeight: '800' },
  date: { color: '#64748b', fontSize: 10 },
});
