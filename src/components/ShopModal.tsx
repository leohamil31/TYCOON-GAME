import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';
import { COIN_PACKS, formatBRL, ITEMS, type ShopItem } from '../shop/catalog';
import { useProfile } from '../state/useProfile';
import { alpha, glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon } from './AnimatedIcon';
import { ActionButton, Banner, GlassModal } from './GlassModal';
import { Odometer } from './Odometer';
import { ThemedBackdrop } from './ThemedBackdrop';

export type ShopTab = 'boards' | 'powerups' | 'coins';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialTab?: ShopTab;
}

const TABS: { id: ShopTab; label: string; icon: string }[] = [
  { id: 'boards', label: 'Tabuleiros', icon: '🎨' },
  { id: 'powerups', label: 'Power-ups', icon: '⚡' },
  { id: 'coins', label: 'Moedas', icon: '🪙' },
];

export function ShopModal({ visible, onClose, initialTab = 'boards' }: Props) {
  const { profile, mode, purchase, simulatedIap, equipBoard } = useProfile();
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      setMsg(null);
    }
  }, [visible, initialTab]);

  const report = async (action: Promise<string | null>, success: string) => {
    const err = await action;
    setMsg(err ? { text: err, kind: 'error' } : { text: success, kind: 'ok' });
  };

  const coins = profile?.coins ?? 0;
  const boards = ITEMS.filter((i) => i.kind === 'board');
  const powerups = ITEMS.filter((i) => i.kind === 'consumable');

  const header = (
    <View>
      <View style={styles.wallet}>
        <AnimatedIcon glyph="🪙" size={22} motion="spin" speed={3200} />
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Odometer value={coins} fontSize={24} color={NEON.gold} glow="rgba(250,204,21,0.7)" />
        </View>
        <Text style={styles.walletHint}>moedas</Text>
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => { setTab(t.id); setMsg(null); }} style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.id && { color: '#fff' }]}>
              {t.icon} {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'local' && (
        <Banner text="Modo demonstração: compras salvas só neste aparelho. Configure a API para validar no servidor." />
      )}
      {msg && <Banner text={msg.text} kind={msg.kind} />}
    </View>
  );

  return (
    <GlassModal visible={visible} onClose={onClose} title="LOJA" icon="🛒" tone={NEON.gold} header={header}>
      {!profile ? (
        <Text style={styles.empty}>Carregando perfil…</Text>
      ) : tab === 'boards' ? (
        <View style={styles.grid}>
          {boards.map((b, i) => {
            const owned = profile.boards.includes(b.id);
            const equipped = profile.equipped === b.id;
            return (
              <Card key={b.id} index={i}>
                <View style={styles.preview}>
                  <ThemedBackdrop themeId={b.id} preview />
                  <View style={styles.previewIcon}>
                    <AnimatedIcon glyph={b.icon} size={34} motion="float" />
                  </View>
                  {!owned && <Text style={styles.lock}>🔒</Text>}
                </View>
                <Text style={styles.name}>{b.name}</Text>
                <Text style={styles.desc}>{b.desc}</Text>
                <View style={styles.actions}>
                  {owned ? (
                    <ActionButton
                      label={equipped ? '✔ Em uso' : 'Usar'}
                      tone={NEON.green}
                      disabled={equipped}
                      onPress={() => report(equipBoard(b.id), `${b.name} equipado!`)}
                    />
                  ) : (
                    <>
                      <ActionButton
                        label={`🪙 ${b.price}`}
                        tone={NEON.gold}
                        disabled={coins < b.price}
                        onPress={() => report(purchase(b.id), `${b.name} desbloqueado!`)}
                      />
                      {b.realCents ? (
                        <ActionButton
                          label={`${formatBRL(b.realCents)} (simulado)`}
                          tone={NEON.violet}
                          ghost
                          small
                          onPress={() => report(simulatedIap(b.id), `${b.name} desbloqueado (compra simulada)!`)}
                        />
                      ) : null}
                    </>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      ) : tab === 'powerups' ? (
        <View>
          {powerups.map((p, i) => (
            <PowerRow
              key={p.id}
              index={i}
              item={p}
              have={profile.inventory[p.id] ?? 0}
              coins={coins}
              onBuy={() => report(purchase(p.id), `${p.name} comprado!`)}
            />
          ))}
          <Text style={styles.hint}>Use os power-ups durante a partida solo.</Text>
        </View>
      ) : (
        <View>
          {COIN_PACKS.map((pk, i) => (
            <Card key={pk.id} index={i} row>
              <AnimatedIcon glyph={pk.icon} size={34} motion="pulse" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{pk.coins} moedas</Text>
                <Text style={styles.desc}>Compra simulada — sem cobrança real.</Text>
              </View>
              <ActionButton
                label={formatBRL(pk.realCents)}
                tone={NEON.violet}
                onPress={() => report(simulatedIap(pk.id), `+${pk.coins} moedas!`)}
              />
            </Card>
          ))}
          <Text style={styles.hint}>Você também ganha moedas jogando: 1 moeda a cada 20 pontos.</Text>
        </View>
      )}
    </GlassModal>
  );
}

function PowerRow({ item, have, coins, onBuy, index }: { item: ShopItem; have: number; coins: number; onBuy: () => Promise<void>; index: number }) {
  return (
    <Card index={index} row>
      <AnimatedIcon glyph={item.icon} size={34} motion="wiggle" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name}>
          {item.name} <Text style={styles.have}>x{have}</Text>
        </Text>
        <Text style={styles.desc}>{item.desc}</Text>
      </View>
      <ActionButton label={`🪙 ${item.price}`} tone={NEON.gold} disabled={coins < item.price} onPress={onBuy} />
    </Card>
  );
}

/** Cartão de vidro com entrada escalonada. */
function Card({ children, index, row }: { children: React.ReactNode; index: number; row?: boolean }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 380, delay: index * 70, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [enter, index]);
  return (
    <Animated.View
      style={[
        styles.card,
        glass,
        row && styles.cardRow,
        !row && styles.cardGrid,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wallet: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, marginBottom: 10, backgroundColor: alpha('#facc15', 0.08), borderWidth: 1, borderColor: alpha('#facc15', 0.35) },
  walletHint: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tabs: { flexDirection: 'row', marginBottom: 10, gap: 6 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.1)' },
  tabOn: { backgroundColor: alpha('#38bdf8', 0.3), borderWidth: 1, borderColor: alpha('#38bdf8', 0.7) },
  tabText: { color: COLORS.muted, fontSize: 11.5, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { borderRadius: 16, padding: 10, marginBottom: 10 },
  cardGrid: { width: '48.5%', minWidth: 150 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { height: 90, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  previewIcon: { position: 'absolute' },
  lock: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  name: { color: '#fff', fontWeight: '900', fontSize: 14 },
  have: { color: NEON.gold, fontSize: 13 },
  desc: { color: COLORS.muted, fontSize: 11.5, marginTop: 2, marginBottom: 8 },
  actions: { alignItems: 'stretch', gap: 6 },
  hint: { color: COLORS.muted, fontSize: 11.5, textAlign: 'center', marginTop: 4 },
  empty: { color: COLORS.muted, textAlign: 'center', padding: 24 },
});
