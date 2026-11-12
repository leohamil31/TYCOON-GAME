import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic, play } from '../services/sfx';
import type { Mission } from '../shop/types';
import { useProfile } from '../state/useProfile';
import { useProgress } from '../state/useProgress';
import { alpha, glass, gradient, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { ChestModal } from './ChestModal';

/** Barra que enche suavemente até `value` (0..1). */
function Bar({ value, tone, height = 8 }: { value: number; tone: string; height?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, value)), duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, v]);
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <Animated.View
        style={[
          styles.fill,
          gradient(90, [tone, alpha(tone, 0.6)], tone),
          { borderRadius: height, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

function MissionRow({ m, onClaim, busy }: { m: Mission; onClaim: () => void; busy: boolean }) {
  const done = m.progress >= m.target;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!done || m.claimed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(glow, { toValue: 0, duration: 600, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [done, m.claimed, glow]);

  return (
    <View style={[styles.mission, m.claimed && { opacity: 0.55 }]}>
      <Text style={styles.mIcon}>{m.claimed ? '✅' : m.icon}</Text>
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <Text style={styles.mTitle} numberOfLines={1}>
          {m.title}
          {m.battle ? ' ⚔️' : ''}
        </Text>
        <View style={styles.mRow}>
          <View style={{ flex: 1 }}>
            <Bar value={m.progress / m.target} tone={done ? NEON.green : NEON.cyan} height={6} />
          </View>
          <Text style={styles.mCount}>
            {m.progress}/{m.target}
          </Text>
        </View>
      </View>
      {m.claimed ? (
        <Text style={styles.mDone}>Feito</Text>
      ) : done ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={onClaim}>
          <Animated.View
            style={[styles.claim, { transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]}
          >
            <Text style={styles.claimText}>🪙 {m.reward}</Text>
          </Animated.View>
        </Pressable>
      ) : (
        <Text style={styles.mReward}>🪙 {m.reward}</Text>
      )}
    </View>
  );
}

/** Nível + baús + sequência + recompensa diária + missões do dia (menu principal). */
export function ProgressPanel({ onToast }: { onToast?: (text: string) => void }) {
  const { profile } = useProfile();
  const { enabled, daily, claimDaily, claimMission } = useProgress();
  const [busy, setBusy] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const chestPulse = useRef(new Animated.Value(0)).current;
  const chests = profile?.chests ?? 0;

  useEffect(() => {
    if (chests <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chestPulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(chestPulse, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [chests, chestPulse]);

  if (!enabled || !profile) return null;
  const level = profile.level ?? 1;
  const into = profile.xpInto ?? 0;
  const need = profile.xpNeed ?? 100;
  const streak = daily?.streak ?? profile.streak ?? 0;

  const getDaily = async () => {
    setBusy(true);
    const r = await claimDaily();
    setBusy(false);
    if (typeof r === 'string') return onToast?.(r);
    play('coin');
    haptic('medium');
    onToast?.(`Dia ${r.streak} seguido! +${r.coins} moedas${r.chest ? ' e 1 baú 🎁' : ''}`);
  };

  const getMission = async (m: Mission) => {
    setBusy(true);
    const err = await claimMission(m.id);
    setBusy(false);
    if (err) return onToast?.(err);
    play('coin');
    haptic('light');
    onToast?.(`Missão concluída! +${m.reward} moedas e +${m.xp} XP`);
  };

  return (
    <View style={[styles.card, glass]}>
      {/* Nível e XP */}
      <View style={styles.levelRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelSmall}>NÍVEL</Text>
          <Text style={styles.levelNum}>{level}</Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <View style={styles.xpHead}>
            <Text style={styles.xpLabel}>XP</Text>
            <Text style={styles.xpText}>
              {into}/{need}
            </Text>
          </View>
          <Bar value={into / need} tone={NEON.violet} height={10} />
          <Text style={styles.xpHint}>Subir de nível dá 1 baú 🎁</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir baú (${chests})`}
          onPress={() => (chests > 0 ? setChestOpen(true) : onToast?.('Suba de nível para ganhar baús!'))}
        >
          <Animated.View
            style={[
              styles.chestBtn,
              chests > 0 && styles.chestOn,
              { transform: [{ scale: chestPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] },
            ]}
          >
            <Text style={{ fontSize: 26, opacity: chests > 0 ? 1 : 0.45 }}>🎁</Text>
            {chests > 0 && (
              <View style={styles.chestBadge}>
                <Text style={styles.chestBadgeText}>{chests}</Text>
              </View>
            )}
          </Animated.View>
        </Pressable>
      </View>

      {/* Recompensa diária + sequência */}
      <View style={styles.dailyRow}>
        <AnimatedIcon glyph="🔥" size={22} motion={streak > 0 ? 'pulse' : 'float'} speed={1200} active={streak > 0} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.dailyTitle}>{streak > 0 ? `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}` : 'Comece sua sequência'}</Text>
          <View style={styles.dots}>
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={[styles.dot, i < streak % 7 || (streak > 0 && streak % 7 === 0) ? styles.dotOn : null, i === 6 && styles.dotChest]}>
                {i === 6 && <Text style={{ fontSize: 9 }}>🎁</Text>}
              </View>
            ))}
          </View>
        </View>
        {daily?.canClaimDaily ? (
          <Pressable accessibilityRole="button" onPress={getDaily} disabled={busy}>
            <View style={styles.dailyBtn}>
              {busy ? (
                <ActivityIndicator color="#0b1022" />
              ) : (
                <Text style={styles.dailyBtnText}>
                  Pegar 🪙 {daily.dailyCoins}
                  {daily.dailyChest ? ' + 🎁' : ''}
                </Text>
              )}
            </View>
          </Pressable>
        ) : (
          <Text style={styles.dailyDone}>✔ Volte amanhã</Text>
        )}
      </View>

      {/* Missões */}
      <Text style={styles.section}>🎯 MISSÕES DE HOJE</Text>
      {daily ? (
        daily.missions.map((m) => <MissionRow key={m.id} m={m} busy={busy} onClaim={() => void getMission(m)} />)
      ) : (
        <ActivityIndicator color={NEON.cyan} style={{ paddingVertical: 10 }} />
      )}
      <Text style={styles.foot}>Missões novas todo dia à meia-noite (horário de Brasília).</Text>

      <ChestModal visible={chestOpen} onClose={() => setChestOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 14, alignSelf: 'stretch' },
  track: { backgroundColor: 'rgba(148,163,184,0.18)', overflow: 'hidden' },
  fill: { height: '100%' },
  levelRow: { flexDirection: 'row', alignItems: 'center' },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(NEON.violet, 0.25),
    borderWidth: 2,
    borderColor: alpha(NEON.violet, 0.8),
  },
  levelSmall: { color: '#c4b5fd', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  levelNum: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: -2 },
  xpHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  xpLabel: { color: '#c4b5fd', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  xpText: { color: '#e2e8f0', fontSize: 11, fontWeight: '800' },
  xpHint: { color: '#64748b', fontSize: 10, marginTop: 4 },
  chestBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  chestOn: { backgroundColor: alpha(NEON.gold, 0.2), borderColor: NEON.gold },
  chestBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f43f5e',
    borderWidth: 2,
    borderColor: '#0b1022',
  },
  chestBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: alpha('#fb923c', 0.1),
    borderWidth: 1,
    borderColor: alpha('#fb923c', 0.35),
  },
  dailyTitle: { color: '#fed7aa', fontSize: 13, fontWeight: '900' },
  dots: { flexDirection: 'row', gap: 4, marginTop: 5 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(148,163,184,0.2)', alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: '#fb923c' },
  dotChest: { width: 18, height: 18, borderRadius: 9, marginTop: -2 },
  dailyBtn: { backgroundColor: NEON.gold, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: 96, alignItems: 'center' },
  dailyBtnText: { color: '#0b1022', fontWeight: '900', fontSize: 13 },
  dailyDone: { color: '#86efac', fontSize: 12, fontWeight: '800' },
  section: { color: '#a5b4fc', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  mission: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  mIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  mTitle: { color: '#f1f5f9', fontSize: 13, fontWeight: '800' },
  mRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 8 },
  mCount: { color: '#94a3b8', fontSize: 11, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  mReward: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
  mDone: { color: '#86efac', fontSize: 12, fontWeight: '800' },
  claim: { backgroundColor: NEON.green, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  claimText: { color: '#052e16', fontWeight: '900', fontSize: 12 },
  foot: { color: '#64748b', fontSize: 10, textAlign: 'center', marginTop: 6 },
});
