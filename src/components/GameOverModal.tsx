import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { showRewardedAd } from '../services/ads';
import { alpha, glassStrong, gradient, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { Confetti } from './Confetti';
import { Odometer } from './Odometer';

export interface RescueOption {
  id: string;
  icon: string;
  label: string;
  count: number;
}

interface Props {
  visible: boolean;
  score: number;
  /** Recorde antes desta partida. */
  prevBest: number;
  coins: number;
  canRevive: boolean;
  adsRemoved: boolean;
  onRevive: () => void;
  onRestart: () => void;
  onMenu: () => void;
  /** Itens do inventário que podem salvar a partida (escudo, nova mão, desfazer, bomba). */
  rescues: RescueOption[];
  onRescue: (id: string) => void;
}

function Big({
  label,
  icon,
  tone,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  icon: string;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, friction: 5, tension: 240, useNativeDriver: USE_NATIVE_DRIVER }).start();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(1)}
      onHoverIn={() => to(1.03)}
      onHoverOut={() => to(1)}
    >
      <Animated.View
        style={[
          styles.big,
          gradient(135, [alpha(tone, 0.85), alpha(tone, 0.5)], alpha(tone, 0.7)),
          { borderColor: alpha(tone, 1), shadowColor: tone, opacity: disabled ? 0.5 : 1, transform: [{ scale }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#0b1022" />
        ) : (
          <Text style={styles.bigText}>
            {icon} {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function GameOverModal({
  visible,
  score,
  prevBest,
  coins,
  canRevive,
  adsRemoved,
  onRevive,
  onRestart,
  onMenu,
  rescues,
  onRescue,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;
  const isRecord = score > 0 && score > prevBest;

  useEffect(() => {
    if (!visible) return;
    setError(null);
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 200, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [visible, enter]);

  const revive = async () => {
    setError(null);
    if (adsRemoved) {
      onRevive();
      return;
    }
    setLoading(true);
    try {
      if (await showRewardedAd()) onRevive();
      else setError('Anúncio indisponível ou não concluído. Tente mais tarde.');
    } catch {
      setError('Algo deu errado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const available = rescues.filter((r) => r.count > 0);
  const tone = isRecord ? NEON.gold : NEON.pink;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onMenu}>
      <View style={styles.backdrop}>
        {isRecord && visible && <Confetti count={46} loops={3} />}
        <ScrollView contentContainerStyle={styles.center} style={{ alignSelf: 'stretch' }}>
          <Animated.View
            style={[
              styles.card,
              glassStrong,
              {
                width: Math.min(width - 32, 420),
                maxHeight: height - 32,
                borderColor: alpha(tone, 0.6),
                shadowColor: tone,
                opacity: enter,
                transform: [
                  { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) },
                  { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              },
            ]}
          >
            <AnimatedIcon
              glyph={isRecord ? '🏆' : '🧱'}
              size={52}
              motion={isRecord ? 'pulse' : 'wiggle'}
              speed={isRecord ? 900 : 1600}
            />
            <Text style={[styles.title, { textShadowColor: tone }]}>{isRecord ? 'NOVO RECORDE!' : 'SEM JOGADAS!'}</Text>

            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>PONTUAÇÃO</Text>
              <Odometer value={score} fontSize={52} color="#fff" glow={alpha(tone, 0.9)} />
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>RECORDE</Text>
                  <Text style={[styles.statValue, { color: NEON.gold }]}>🏆 {Math.max(prevBest, score)}</Text>
                </View>
                <View style={styles.sep} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>MOEDAS</Text>
                  <Text style={[styles.statValue, { color: NEON.gold }]}>🪙 +{coins}</Text>
                </View>
              </View>
            </View>

            {available.length > 0 && (
              <>
                <Text style={styles.section}>SALVE A PARTIDA COM UM ITEM</Text>
                <View style={styles.rescueRow}>
                  {available.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${r.label}`}
                      onPress={() => onRescue(r.id)}
                      disabled={loading}
                      style={({ pressed }: { pressed: boolean }) => [styles.rescue, pressed && { transform: [{ scale: 0.94 }] }]}
                    >
                      <Text style={styles.rescueIcon}>{r.icon}</Text>
                      <Text style={styles.rescueLabel} numberOfLines={1}>
                        {r.label}
                      </Text>
                      <View style={styles.rescueBadge}>
                        <Text style={styles.rescueBadgeText}>{r.count}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <View style={styles.actions}>
              {canRevive && (
                <Big
                  label={adsRemoved ? 'Continuar' : 'Ver anúncio e continuar'}
                  icon={adsRemoved ? '💥' : '📺'}
                  tone={NEON.green}
                  onPress={revive}
                  disabled={loading}
                  loading={loading}
                />
              )}
              {error && <Text style={styles.error}>{error}</Text>}
              <Big label="Jogar de novo" icon="🔁" tone={NEON.cyan} onPress={onRestart} disabled={loading} />
              <Pressable accessibilityRole="button" onPress={onMenu} disabled={loading} style={styles.menu}>
                <Text style={styles.menuText}>‹ Voltar ao menu</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.82)', alignItems: 'center', justifyContent: 'center' },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { borderRadius: 28, borderWidth: 2, padding: 20, alignItems: 'center', shadowOpacity: 0.6, shadowRadius: 30 },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 4,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  scoreBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(2,6,23,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  scoreLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stat: { alignItems: 'center', paddingHorizontal: 18 },
  statLabel: { color: '#64748b', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  statValue: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  sep: { width: 1, height: 28, backgroundColor: 'rgba(148,163,184,0.25)' },
  section: { color: '#a5b4fc', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  rescueRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  rescue: {
    width: 76,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: alpha('#a78bfa', 0.18),
    borderWidth: 1.5,
    borderColor: alpha('#a78bfa', 0.7),
  },
  rescueIcon: { fontSize: 26 },
  rescueLabel: { color: '#ede9fe', fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  rescueBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEON.violet,
    borderWidth: 2,
    borderColor: '#0b1022',
  },
  rescueBadgeText: { color: '#0b1022', fontSize: 11, fontWeight: '900' },
  actions: { alignSelf: 'stretch', marginTop: 16, gap: 10 },
  big: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  bigText: { color: '#0b1022', fontWeight: '900', fontSize: 15 },
  error: { color: '#fca5a5', textAlign: 'center', fontSize: 12 },
  menu: { alignItems: 'center', paddingVertical: 8 },
  menuText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
});
