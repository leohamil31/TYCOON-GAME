import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic, play } from '../services/sfx';
import { itemById } from '../shop/catalog';
import type { ChestReward } from '../shop/types';
import { useProfile } from '../state/useProfile';
import { useProgress } from '../state/useProgress';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';
import { Confetti } from './Confetti';

type Phase = 'ready' | 'opening' | 'reveal';

const describe = (r: ChestReward): { icon: string; title: string; sub: string; rare: boolean } => {
  if (r.kind === 'coins') return { icon: '🪙', title: `+${r.amount} moedas`, sub: 'Direto na carteira', rare: false };
  if (r.kind === 'cosmetic') {
    const it = itemById(r.id);
    return { icon: it?.icon ?? '✨', title: it?.name ?? r.id, sub: 'Item RARO desbloqueado! Equipe na loja.', rare: true };
  }
  const list = Object.entries(r.items).map(([id, n]) => `${itemById(id)?.icon ?? ''} ${itemById(id)?.name ?? id} ×${n}`);
  return { icon: '🎒', title: 'Itens!', sub: list.join('   '), rare: false };
};

/** Abrir baú: toque → baú treme → estoura → revela o prêmio (moedas, itens ou cosmético raro). */
export function ChestModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile } = useProfile();
  const { openChest } = useProgress();
  const [phase, setPhase] = useState<Phase>('ready');
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const show = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setPhase('ready');
    setReward(null);
    setError(null);
    burst.setValue(0);
    show.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(idle, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, burst, show, idle]);

  const open = async () => {
    if (phase !== 'ready') return;
    setPhase('opening');
    haptic([20, 30, 20, 30, 20]);
    // Treme enquanto o servidor sorteia o prêmio.
    const wobble = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    wobble.start();
    const [r] = await Promise.all([openChest(), new Promise((res) => setTimeout(res, 650))]);
    wobble.stop();
    shake.setValue(0);
    if (typeof r === 'string') {
      setError(r);
      setPhase('ready');
      return;
    }
    setReward(r);
    setPhase('reveal');
    play('chest');
    haptic('heavy');
    Animated.parallel([
      Animated.timing(burst, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(show, { toValue: 1, friction: 6, tension: 160, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  };

  if (!visible) return null;
  const info = reward ? describe(reward) : null;
  const left = profile?.chests ?? 0;
  const tone = info?.rare ? NEON.pink : NEON.gold;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {phase === 'reveal' && <Confetti count={info?.rare ? 60 : 30} loops={1} />}
        <View style={[styles.card, glassStrong, { borderColor: alpha(tone, 0.7) }]}>
          <Text style={styles.title}>{phase === 'reveal' ? (info?.rare ? 'RARO!' : 'VOCÊ GANHOU') : 'BAÚ DE NÍVEL'}</Text>

          <View style={styles.stage}>
            <Animated.View
              style={[
                styles.ring,
                {
                  borderColor: tone,
                  opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
                  transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }],
                },
              ]}
            />
            {phase !== 'reveal' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Abrir baú" onPress={open}>
                <Animated.Text
                  style={[
                    styles.chest,
                    {
                      transform: [
                        { translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                        { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] }) },
                        { scale: phase === 'opening' ? 1.12 : 1 },
                      ],
                    },
                  ]}
                >
                  🎁
                </Animated.Text>
              </Pressable>
            ) : (
              <Animated.Text
                style={[
                  styles.chest,
                  { opacity: show, transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] },
                ]}
              >
                {info?.icon}
              </Animated.Text>
            )}
          </View>

          {phase === 'reveal' && info ? (
            <Animated.View style={{ alignItems: 'center', opacity: show }}>
              <Text style={[styles.reward, { color: tone }]}>{info.title}</Text>
              <Text style={styles.sub}>{info.sub}</Text>
            </Animated.View>
          ) : (
            <Text style={styles.sub}>{phase === 'opening' ? 'Abrindo…' : 'Toque no baú para abrir'}</Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            {phase === 'reveal' && left > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPhase('ready');
                  setReward(null);
                  burst.setValue(0);
                  show.setValue(0);
                }}
                style={[styles.btn, { backgroundColor: NEON.gold }]}
              >
                <Text style={styles.btnText}>Abrir outro ({left})</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.btn, styles.close]}>
              <Text style={[styles.btnText, { color: '#e2e8f0' }]}>{phase === 'reveal' ? 'Pegar' : 'Depois'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, borderRadius: 26, borderWidth: 2, padding: 20, alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  stage: { height: 170, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 5 },
  chest: { fontSize: 96, lineHeight: 112, textAlign: 'center' },
  reward: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  sub: { color: '#cbd5e1', fontSize: 13, textAlign: 'center', marginTop: 4 },
  error: { color: '#fca5a5', fontSize: 12, marginTop: 8, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 18 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  close: { backgroundColor: 'rgba(148,163,184,0.18)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.4)' },
  btnText: { color: '#0b1022', fontWeight: '900', fontSize: 15 },
});
