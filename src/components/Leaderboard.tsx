import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { backend } from '../services/api';
import type { RankEntry } from '../shop/types';
import { useProfile } from '../state/useProfile';
import { alpha, glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { ScoreEntry } from '../types';
import { AnimatedIcon } from './AnimatedIcon';
import { Odometer } from './Odometer';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Linha genérica do ranking. `rank` é a posição (0 = primeiro). */
interface RowData {
  key: string;
  name: string;
  sub: string;
  score: number;
}

function Row({ entry, rank, highlight }: { entry: RowData; rank: number; highlight: boolean }) {
  const enter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 450,
      delay: Math.min(rank, 8) * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    // Numbers roll up from 0 once the row has slid in.
    const t = setTimeout(() => setShown(entry.score), 200 + Math.min(rank, 8) * 80);
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
        <Text style={styles.date}>{entry.sub}</Text>
      </View>
      <Odometer value={shown} fontSize={20} color={top ? NEON.gold : '#e2e8f0'} glow={top ? 'rgba(250,204,21,0.7)' : undefined} />
    </Animated.View>
  );
}

type Tab = 'global' | 'friends' | 'local';

const TABS: { id: Tab; label: string }[] = [
  { id: 'global', label: '🌎 Global' },
  { id: 'friends', label: '👥 Amigos' },
  { id: 'local', label: '📱 Aparelho' },
];

interface Props {
  /** Partidas salvas neste aparelho (aba "Aparelho"). */
  entries: ScoreEntry[];
  /** Entry id to highlight (the run that just finished). */
  highlightId?: number | null;
  limit?: number;
}

const winsText = (w: number) => (w > 0 ? `⚔️ ${w} vitória${w > 1 ? 's' : ''}` : 'sem vitórias ainda');

/** Ranking de melhores jogadores: global e amigos (servidor) + partidas deste aparelho. */
export function Leaderboard({ entries, highlightId = null, limit = 5 }: Props) {
  const { mode, profile } = useProfile();
  const online = mode === 'remote' && !!backend.leaderboard;
  const [tab, setTab] = useState<Tab>(online ? 'global' : 'local');
  const [remote, setRemote] = useState<RankEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (online) setTab((t) => (t === 'local' ? 'global' : t));
  }, [online]);

  const load = useCallback(async () => {
    if (!online || tab === 'local' || !backend.leaderboard) return;
    setError(false);
    try {
      setRemote(await backend.leaderboard(tab));
    } catch {
      setError(true);
    }
  }, [online, tab]);

  // Recarrega ao trocar de aba e quando o recorde do jogador muda.
  useEffect(() => {
    setRemote(null);
    void load();
  }, [load, profile?.best, profile?.wins]);

  let rows: { data: RowData; me: boolean; pos: number }[] = [];
  if (tab === 'local') {
    rows = entries.slice(0, limit).map((e, i) => ({
      data: { key: String(e.id), name: e.name, sub: new Date(e.date).toLocaleDateString('pt-BR'), score: e.score },
      me: e.id === highlightId,
      pos: i,
    }));
  } else if (remote) {
    const top = remote.filter((r) => r.rank <= 10 || r.me);
    rows = top.map((r) => ({
      data: { key: `${r.rank}-${r.name}-${r.code ?? ''}`, name: r.me ? `${r.name} (você)` : r.name, sub: winsText(r.wins), score: r.best },
      me: !!r.me,
      pos: r.rank - 1,
    }));
  }

  return (
    <View style={[styles.card, glass]}>
      <View style={styles.header}>
        <AnimatedIcon glyph="🏆" size={22} motion="float" />
        <Text style={styles.title}>RANKING</Text>
        <AnimatedIcon glyph="✨" size={16} motion="spin" speed={5000} style={{ marginLeft: 'auto' }} />
      </View>
      <View style={styles.tabs}>
        {TABS.filter((t) => online || t.id === 'local').map((t) => (
          <Pressable key={t.id} accessibilityRole="button" onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab !== 'local' && !remote && !error ? (
        <ActivityIndicator color={NEON.cyan} style={{ paddingVertical: 18 }} />
      ) : error ? (
        <Pressable onPress={() => void load()}>
          <Text style={styles.empty}>Não foi possível carregar o ranking. Toque para tentar de novo.</Text>
        </Pressable>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>
          {tab === 'friends' ? 'Adicione amigos para comparar recordes!' : 'Jogue uma partida para entrar no ranking!'}
        </Text>
      ) : (
        rows.map((r) => <Row key={r.data.key} entry={r.data} rank={r.pos} highlight={r.me} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 14, alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 15, fontWeight: '900', letterSpacing: 4, marginLeft: 8 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.1)' },
  tabOn: { backgroundColor: alpha('#facc15', 0.22), borderWidth: 1, borderColor: alpha('#facc15', 0.6) },
  tabText: { color: '#94a3b8', fontSize: 11.5, fontWeight: '800' },
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
