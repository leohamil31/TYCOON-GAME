import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AmbientOrbs } from '../components/AmbientOrbs';
import { BottomNav, type NavItem } from '../components/BottomNav';
import { FriendsPanel } from '../components/FriendsPanel';
import { GlassButton } from '../components/GlassButton';
import { Leaderboard } from '../components/Leaderboard';
import { SettingsModal } from '../components/SettingsModal';
import { ShopModal } from '../components/ShopModal';
import { ThemedBackdrop } from '../components/ThemedBackdrop';
import { TitleLogo } from '../components/TitleLogo';
import { TopBar } from '../components/TopBar';
import { isUserCode, normalizeUserCode } from '../shop/types';
import { useProfile } from '../state/useProfile';
import { loadScores } from '../storage';
import { NEON, PALETTE, USE_NATIVE_DRIVER } from '../theme';
import type { ScoreEntry } from '../types';

interface Props {
  onSolo: () => void;
  onOnline: () => void;
  /** Desafiar um amigo online (cria sala e envia convite). */
  onChallenge: (friendCode: string, friendName: string) => void;
}

/** Código de amigo vindo do link de convite (?amigo=CODE), só na web. */
const linkInvite = (): string => {
  const loc = (globalThis as { location?: { search: string } }).location;
  if (Platform.OS !== 'web' || !loc) return '';
  const c = normalizeUserCode(new URLSearchParams(loc.search).get('amigo') ?? '');
  return isUserCode(c) ? c : '';
};

export function MenuScreen({ onSolo, onOnline, onChallenge }: Props) {
  const { width, height } = useWindowDimensions();
  const { profile } = useProfile();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [shop, setShop] = useState(false);
  const [settings, setSettings] = useState(false);
  const [inviteCode] = useState(linkInvite);
  const [friendsOpen, setFriendsOpen] = useState(inviteCode !== '');
  const wide = width >= 820;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void loadScores().then(setScores);
    Animated.timing(enter, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [enter]);

  const best = Math.max(profile?.best ?? 0, ...scores.map((s) => s.score));

  const nav = useMemo<NavItem[]>(
    () => [
      { key: 'play', label: 'Jogar', icon: '🎮', tone: NEON.green, onPress: onSolo },
      { key: 'shop', label: 'Loja', icon: '🛒', tone: NEON.gold, onPress: () => setShop(true) },
      { key: 'friends', label: 'Amigos', icon: '👥', tone: NEON.cyan, onPress: () => setFriendsOpen(true) },
      { key: 'settings', label: 'Ajustes', icon: '⚙️', tone: NEON.violet, onPress: () => setSettings(true) },
    ],
    [onSolo],
  );

  return (
    <View style={styles.root}>
      <ThemedBackdrop themeId={profile?.equipped ?? 'classic'} />
      <AmbientOrbs />
      <ShopModal visible={shop} onClose={() => setShop(false)} />
      <FriendsPanel
        visible={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        initialCode={inviteCode}
        onChallenge={(code, name) => {
          setFriendsOpen(false);
          onChallenge(code, name);
        }}
      />
      <SettingsModal visible={settings} onClose={() => setSettings(false)} onOpenShop={() => setShop(true)} />

      <View style={styles.frame}>
        <View style={styles.top}>
          <TopBar
            name={profile?.name ?? 'Jogador'}
            coins={profile?.coins ?? 0}
            best={best}
            onWallet={() => setShop(true)}
            onProfile={() => setSettings(true)}
          />
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, wide && styles.scrollWide]} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.col,
              wide && styles.colWide,
              { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
            ]}
          >
            <TitleLogo compact={height < 700} />
            <View style={styles.buttons}>
              <GlassButton title="Jogar Offline" subtitle="Modo solo clássico" icon="🎮" tone={NEON.green} delay={150} pulse onPress={onSolo} />
              <View style={{ height: 14 }} />
              <GlassButton
                title="Batalha Online"
                subtitle="Crie uma sala e desafie um amigo"
                icon="⚔️"
                tone={NEON.pink}
                delay={300}
                onPress={onOnline}
              />
            </View>
            <Text style={styles.foot}>Encaixe os blocos • complete linhas • faça combos</Text>
          </Animated.View>
          <View style={[styles.col, wide ? styles.colWide : { marginTop: 22 }]}>
            <Leaderboard entries={scores} />
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <BottomNav items={nav} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.void },
  frame: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  top: { paddingHorizontal: 12, paddingTop: 12 },
  bottom: { paddingHorizontal: 12, paddingBottom: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  scrollWide: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  col: { width: '100%', maxWidth: 420, alignItems: 'center' },
  colWide: { width: 420, marginHorizontal: 24 },
  buttons: { alignSelf: 'stretch', marginTop: 8 },
  foot: { color: 'rgba(226,232,240,0.6)', fontSize: 12, marginTop: 18, textAlign: 'center' },
});
