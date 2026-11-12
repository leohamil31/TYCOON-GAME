import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { listenInvites, type Invite } from '../services/invites';
import { useProfile } from '../state/useProfile';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';

interface Props {
  /** Não mostrar convites enquanto já estiver numa batalha. */
  busy: boolean;
  onAccept: (inv: Invite) => void;
}

/** Faixa global "Fulano te desafiou!" que aparece em qualquer tela quando chega um convite. */
export function InviteBanner({ busy, onAccept }: Props) {
  const { profile, mode } = useProfile();
  const [invite, setInvite] = useState<Invite | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const code = profile?.userId;

  useEffect(() => {
    if (!code || mode !== 'remote') return;
    return listenInvites(code, (inv) => setInvite(inv));
  }, [code, mode]);

  useEffect(() => {
    if (!invite) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 6, tension: 120, useNativeDriver: USE_NATIVE_DRIVER }).start();
    const t = setTimeout(() => setInvite(null), 45_000); // convite expira
    return () => clearTimeout(t);
  }, [invite, v]);

  if (!invite || busy) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        glassStrong,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }],
        },
      ]}
    >
      <AnimatedIcon glyph="⚔️" size={28} motion="wiggle" speed={900} />
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {invite.name} te desafiou!
        </Text>
        <Text style={styles.sub}>Batalha de 2 minutos</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setInvite(null)}
        style={[styles.btn, { borderColor: alpha('#94a3b8', 0.6) }]}
      >
        <Text style={styles.btnText}>Agora não</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const inv = invite;
          setInvite(null);
          onAccept(inv);
        }}
        style={[styles.btn, styles.accept]}
      >
        <Text style={[styles.btnText, { color: '#052e16' }]}>Aceitar</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 20,
    borderColor: alpha(NEON.pink, 0.8),
    borderWidth: 1.5,
    zIndex: 100,
  },
  texts: { flex: 1 },
  title: { color: '#fff', fontWeight: '900', fontSize: 15 },
  sub: { color: '#cbd5e1', fontSize: 11.5, marginTop: 1 },
  btn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5 },
  accept: { backgroundColor: NEON.green, borderColor: NEON.green },
  btnText: { color: '#e2e8f0', fontWeight: '900', fontSize: 13 },
});
