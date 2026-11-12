import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../constants';
import { isUserCode, normalizeUserCode, USER_CODE_LENGTH } from '../shop/types';
import { useProfile } from '../state/useProfile';
import { alpha, glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { ActionButton, Banner, GlassModal } from './GlassModal';
import { Odometer } from './Odometer';

const webGlobal = globalThis as {
  location?: { origin: string; pathname: string };
  navigator?: { clipboard?: { writeText(t: string): Promise<void> } };
};

export const inviteLink = (code: string) =>
  webGlobal.location ? `${webGlobal.location.origin}${webGlobal.location.pathname}?amigo=${code}` : code;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Código vindo de um link de convite (?amigo=CODE). */
  initialCode?: string;
  /** Desafiar um amigo online para uma batalha. */
  onChallenge?: (code: string, name: string) => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const POLL_MS = 5000;

function OnlineDot({ online }: { online: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!online) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [online, v]);
  const color = online ? NEON.green : '#64748b';
  return (
    <View style={styles.dotWrap}>
      {online && (
        <Animated.View
          style={[styles.dotHalo, { backgroundColor: alpha(NEON.green, 0.4), opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.8] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] }) }] }]}
        />
      )}
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export function FriendsPanel({ visible, onClose, initialCode = '', onChallenge }: Props) {
  const { profile, friends, mode, addFriend, removeFriend, refreshFriends } = useProfile();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMsg(null);
    setCode(initialCode);
    void refreshFriends();
    const t = setInterval(() => void refreshFriends(), POLL_MS);
    return () => clearInterval(t);
  }, [visible, initialCode, refreshFriends]);

  const copy = async (text: string, label: string) => {
    try {
      const clip = webGlobal.navigator?.clipboard;
      if (clip) await clip.writeText(text);
      else await Share.share({ message: text });
      setMsg({ text: `${label} copiado!`, kind: 'ok' });
    } catch {
      setMsg({ text: 'Não foi possível copiar.', kind: 'error' });
    }
  };

  const add = async () => {
    const c = normalizeUserCode(code);
    if (!isUserCode(c)) return setMsg({ text: `O código tem ${USER_CODE_LENGTH} caracteres.`, kind: 'error' });
    const err = await addFriend(c);
    if (err) setMsg({ text: err, kind: 'error' });
    else {
      setCode('');
      setMsg({ text: 'Amigo adicionado!', kind: 'ok' });
    }
  };

  const me = profile
    ? { id: profile.userId, name: `${profile.name} (você)`, online: true, score: 0, best: profile.best, self: true }
    : null;
  const ranking = [...friends.map((f) => ({ ...f, self: false })), ...(me ? [me] : [])].sort((a, b) => b.best - a.best);

  return (
    <GlassModal visible={visible} onClose={onClose} title="AMIGOS" icon="👥" tone={NEON.pink}>
      {mode === 'local' && (
        <Banner text="Modo demonstração: sem servidor, os amigos adicionados são simulados. Configure o Supabase (src/services/supabase.ts) para amigos reais." />
      )}

      <View style={[styles.box, glass]}>
        <Text style={styles.label}>SEU CÓDIGO DE AMIGO</Text>
        <Text style={styles.myCode} selectable>
          {profile?.userId ?? '········'}
        </Text>
        <View style={styles.row}>
          <ActionButton small ghost label="📋 Copiar código" tone={NEON.cyan} disabled={!profile} onPress={() => copy(profile!.userId, 'Código')} />
          <ActionButton small ghost label="🔗 Copiar link" tone={NEON.pink} disabled={!profile} onPress={() => copy(inviteLink(profile!.userId), 'Link')} />
        </View>
      </View>

      <View style={[styles.box, glass]}>
        <Text style={styles.label}>ADICIONAR AMIGO</Text>
        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(normalizeUserCode(t))}
            placeholder="CÓDIGO"
            placeholderTextColor="rgba(148,163,184,0.5)"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={USER_CODE_LENGTH}
            onSubmitEditing={add}
            style={styles.input}
          />
          <ActionButton label="➕ Adicionar" tone={NEON.green} disabled={code.length !== USER_CODE_LENGTH} onPress={add} />
        </View>
      </View>

      {msg && <Banner text={msg.text} kind={msg.kind} />}

      <Text style={[styles.label, { marginTop: 4, marginBottom: 8 }]}>RANKING DE AMIGOS</Text>
      {ranking.length <= 1 && <Text style={styles.empty}>Adicione amigos para comparar recordes e ver quem está jogando agora.</Text>}
      {ranking.map((f, i) => (
        <View key={f.id} style={[styles.friend, glass, f.self && styles.friendSelf, i === 0 && styles.friendTop]}>
          <Text style={styles.rank}>{MEDALS[i] ?? `${i + 1}º`}</Text>
          <OnlineDot online={f.online} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fname} numberOfLines={1}>
              {f.name}
            </Text>
            <Text style={[styles.status, { color: f.online ? NEON.green : COLORS.muted }]}>
              {f.self ? 'online' : f.online ? (f.score > 0 ? 'jogando agora' : 'online') : 'offline'}
              {'simulated' in f && f.simulated ? ' • simulado' : ''}
            </Text>
          </View>
          <View style={styles.nums}>
            {!f.self && f.online && f.score > 0 && (
              <View style={styles.numRow}>
                <Text style={styles.tag}>AGORA</Text>
                <Odometer value={f.score} fontSize={15} color={NEON.cyan} />
              </View>
            )}
            <View style={styles.numRow}>
              <AnimatedIcon glyph="🏆" size={13} motion="float" speed={2600} />
              <Odometer value={f.best} fontSize={15} color={NEON.gold} />
            </View>
          </View>
          {!f.self && f.online && mode === 'remote' && onChallenge && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Desafiar ${f.name}`}
              onPress={() => onChallenge(f.id, f.name)}
              style={styles.duel}
            >
              <Text style={styles.duelText}>⚔️ Desafiar</Text>
            </Pressable>
          )}
          {!f.self && (
            <Text onPress={() => void removeFriend(f.id)} style={styles.remove} accessibilityLabel="Remover amigo">
              ✕
            </Text>
          )}
        </View>
      ))}
    </GlassModal>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, padding: 12, marginBottom: 10 },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 6 },
  myCode: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 6, textAlign: 'center', marginVertical: 6, textShadowColor: alpha('#f472b6', 0.8), textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: alpha('#38bdf8', 0.5), backgroundColor: 'rgba(2,6,23,0.5)' },
  empty: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginBottom: 10 },
  friend: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  friendSelf: { borderColor: alpha('#38bdf8', 0.6), backgroundColor: alpha('#38bdf8', 0.1) },
  friendTop: { borderColor: alpha('#facc15', 0.6) },
  rank: { width: 32, fontSize: 18, textAlign: 'center', color: '#fff', fontWeight: '800' },
  dotWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  dotHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  fname: { color: '#fff', fontWeight: '800', fontSize: 14 },
  status: { fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  nums: { alignItems: 'flex-end', marginLeft: 6 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tag: { color: COLORS.muted, fontSize: 9, fontWeight: '800' },
  duel: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: alpha('#f472b6', 0.25), borderWidth: 1.5, borderColor: alpha('#f472b6', 0.8) },
  duelText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  remove: { color: COLORS.muted, fontSize: 14, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 },
});
