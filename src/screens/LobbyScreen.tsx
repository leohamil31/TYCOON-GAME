import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AmbientOrbs } from '../components/AmbientOrbs';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Background } from '../components/Background';
import { GlassButton } from '../components/GlassButton';
import { normalizeCode } from '../services/battle';
import { cleanName, DEFAULT_NAME, loadName, saveName } from '../storage';
import { glass, NEON } from '../theme';
import type { PlayerView } from '../types';
import type { Phase } from '../state/useBattle';

interface Props {
  phase: Phase;
  role: 'host' | 'guest' | null;
  code: string;
  error: string | null;
  me: PlayerView;
  opp: PlayerView | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onStart: () => void;
  onBack: () => void;
  /** Aviso do desafio entre amigos (convite enviado/entrando na sala). */
  notice?: string | null;
}

const webGlobal = globalThis as {
  location?: { origin: string; pathname: string; search: string };
  navigator?: { clipboard?: { writeText(t: string): Promise<void> } };
};

const roomLink = (code: string) =>
  webGlobal.location ? `${webGlobal.location.origin}${webGlobal.location.pathname}?sala=${code}` : code;

const initialCode = () =>
  Platform.OS === 'web' && webGlobal.location
    ? normalizeCode(new URLSearchParams(webGlobal.location.search).get('sala') ?? '')
    : '';

function Dots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 1) % 4), 450);
    return () => clearInterval(id);
  }, []);
  return <Text style={styles.waiting}>{'.'.repeat(n)}</Text>;
}

export function LobbyScreen({ phase, role, code, error, me, opp, onCreate, onJoin, onStart, onBack, notice }: Props) {
  const [name, setName] = useState(DEFAULT_NAME);
  const [joinCode, setJoinCode] = useState(initialCode);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void loadName().then(setName);
  }, []);

  const finalName = () => cleanName(name) || DEFAULT_NAME;
  const commitName = () => {
    const n = finalName();
    void saveName(n);
    return n;
  };

  const share = async (text: string, label: string) => {
    const clip = webGlobal.navigator?.clipboard;
    try {
      if (clip) await clip.writeText(text);
      else await Share.share({ message: text });
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  const inRoom = phase === 'lobby';
  const busy = phase === 'connecting';

  return (
    <View style={styles.root}>
      <Background />
      <AmbientOrbs />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.col}>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
              <Text style={styles.backText}>‹ Menu</Text>
            </Pressable>

            <View style={styles.headRow}>
              <AnimatedIcon glyph="⚔️" size={34} motion="wiggle" speed={1400} />
              <Text style={styles.heading}>BATALHA ONLINE</Text>
            </View>

            {notice && (
              <View style={[styles.card, glass, styles.notice]}>
                <ActivityIndicator color={NEON.pink} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            {!inRoom && (
              <>
                <View style={[styles.card, glass]}>
                  <Text style={styles.label}>SEU NOME</Text>
                  <TextInput
                    value={name}
                    onChangeText={(v) => setName(v.slice(0, 14))}
                    onBlur={commitName}
                    maxLength={14}
                    placeholder="Seu nome"
                    placeholderTextColor="#64748b"
                    style={styles.input}
                  />
                </View>

                <GlassButton
                  title="Criar sala"
                  subtitle="Gere um código e convide um amigo"
                  icon="🏠"
                  tone={NEON.cyan}
                  disabled={busy}
                  onPress={() => onCreate(commitName())}
                />

                <View style={[styles.card, glass, { marginTop: 14 }]}>
                  <Text style={styles.label}>ENTRAR COM CÓDIGO</Text>
                  <TextInput
                    value={joinCode}
                    onChangeText={(v) => setJoinCode(normalizeCode(v))}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={5}
                    placeholder="ABCDE"
                    placeholderTextColor="#475569"
                    style={[styles.input, styles.codeInput]}
                    onSubmitEditing={() => joinCode.length === 5 && onJoin(joinCode, commitName())}
                  />
                </View>
                <GlassButton
                  title="Entrar na sala"
                  icon="🔑"
                  tone={NEON.pink}
                  disabled={busy || joinCode.length !== 5}
                  delay={120}
                  onPress={() => onJoin(joinCode, commitName())}
                />

                {busy && (
                  <View style={styles.status}>
                    <ActivityIndicator color={NEON.cyan} />
                    <Text style={styles.statusText}>Conectando…</Text>
                  </View>
                )}
                {error && !busy && <Text style={styles.error}>{error}</Text>}
              </>
            )}

            {inRoom && (
              <>
                <View style={[styles.card, glass, styles.roomCard]}>
                  <Text style={styles.label}>CÓDIGO DA SALA</Text>
                  <Text style={styles.code} selectable>
                    {code}
                  </Text>
                  <View style={styles.copyRow}>
                    <Pressable style={styles.copyBtn} onPress={() => share(code, 'code')}>
                      <Text style={styles.copyText}>{copied === 'code' ? '✔ Copiado!' : '📋 Copiar código'}</Text>
                    </Pressable>
                    <Pressable style={styles.copyBtn} onPress={() => share(roomLink(code), 'link')}>
                      <Text style={styles.copyText}>{copied === 'link' ? '✔ Copiado!' : '🔗 Copiar link'}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.card, glass]}>
                  <Text style={styles.label}>JOGADORES</Text>
                  <View style={styles.player}>
                    <Text style={styles.pName}>👤 {me.name}</Text>
                    <Text style={styles.pTag}>{role === 'host' ? 'ANFITRIÃO' : 'VOCÊ'}</Text>
                  </View>
                  <View style={styles.player}>
                    {opp ? (
                      <>
                        <Text style={styles.pName}>⚔️ {opp.name}</Text>
                        <Text style={[styles.pTag, { color: NEON.green }]}>PRONTO</Text>
                      </>
                    ) : (
                      <View style={{ flexDirection: 'row' }}>
                        <Text style={[styles.pName, { color: '#64748b' }]}>Aguardando amigo</Text>
                        <Dots />
                      </View>
                    )}
                  </View>
                </View>

                {role === 'host' ? (
                  <GlassButton
                    title="Iniciar batalha"
                    subtitle={opp ? '2 minutos • maior pontuação vence' : 'Espere seu amigo entrar'}
                    icon="🚀"
                    tone={NEON.green}
                    disabled={!opp}
                    onPress={onStart}
                  />
                ) : (
                  <View style={styles.status}>
                    <ActivityIndicator color={NEON.cyan} />
                    <Text style={styles.statusText}>Aguardando o anfitrião iniciar…</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, alignItems: 'center', padding: 16, paddingBottom: 40 },
  col: { alignSelf: 'center', maxWidth: 440, width: '100%' },
  back: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  backText: { color: '#cbd5e1', fontSize: 15, fontWeight: '700' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 14 },
  heading: {
    color: '#ecfeff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    marginLeft: 10,
    textShadowColor: NEON.cyan,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  card: { borderRadius: 20, padding: 14, marginBottom: 14 },
  roomCard: { alignItems: 'center' },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  input: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(2,6,23,0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24 },
  code: {
    color: NEON.gold,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 10,
    marginLeft: 10,
    textShadowColor: 'rgba(250,204,21,0.8)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  copyRow: { flexDirection: 'row', marginTop: 10 },
  copyBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 5,
  },
  copyText: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  player: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  pName: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  pTag: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  waiting: { color: '#64748b', fontSize: 16, fontWeight: '800', width: 20 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  statusText: { color: '#cbd5e1', marginLeft: 10, fontSize: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: 'rgba(244,114,182,0.6)' },
  noticeText: { color: '#fce7f3', fontWeight: '800', fontSize: 14, flex: 1 },
  error: { color: '#fca5a5', textAlign: 'center', marginTop: 14, fontSize: 14, fontWeight: '700' },
});
