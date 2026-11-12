import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';
import { COIN_PACKS, DEFAULT_BOARD, DEFAULT_FX, DEFAULT_SKIN, formatBRL, ITEMS, itemById, type ItemKind, type ShopItem } from '../shop/catalog';
import { useProfile } from '../state/useProfile';
import { alpha, glass, NEON, USE_NATIVE_DRIVER } from '../theme';
import type { Piece } from '../types';
import { AnimatedIcon } from './AnimatedIcon';
import { ActionButton, Banner, GlassModal } from './GlassModal';
import { Odometer } from './Odometer';
import { PieceView } from './Piece';
import { ThemedBackdrop } from './ThemedBackdrop';

export type ShopTab = 'boards' | 'skins' | 'fx' | 'powerups' | 'packs';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialTab?: ShopTab;
}

const TABS: { id: ShopTab; label: string; icon: string }[] = [
  { id: 'boards', label: 'Temas', icon: '🎨' },
  { id: 'skins', label: 'Peças', icon: '🧊' },
  { id: 'fx', label: 'Efeitos', icon: '✨' },
  { id: 'powerups', label: 'Itens', icon: '⚡' },
  { id: 'packs', label: 'Pacotes', icon: '📦' },
];

/** Peça "T" colorida usada na prévia das skins. */
const SAMPLE: Piece[] = [
  { id: -1, color: 4, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: -2, color: 6, cells: [[0, 0], [1, 0], [1, 1]] },
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
  const owned = (i: ShopItem) => i.price === 0 || !!profile?.boards.includes(i.id);
  const equippedOf = (kind: ItemKind) =>
    kind === 'skin' ? (profile?.skin ?? DEFAULT_SKIN) : kind === 'fx' ? (profile?.effect ?? DEFAULT_FX) : (profile?.equipped ?? DEFAULT_BOARD);

  const header = (
    <View>
      <View style={styles.wallet}>
        <AnimatedIcon glyph="🪙" size={22} motion="spin" speed={3200} />
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Odometer value={coins} fontSize={24} color={NEON.gold} glow="rgba(250,204,21,0.7)" />
        </View>
        <Text style={styles.walletHint}>moedas</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              setTab(t.id);
              setMsg(null);
            }}
            style={[styles.tab, tab === t.id && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t.id && { color: '#fff' }]}>
              {t.icon} {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {mode === 'local' && <Banner text="Modo demonstração: compras salvas só neste aparelho." />}
      {msg && <Banner text={msg.text} kind={msg.kind} />}
    </View>
  );

  /** Botões de um cosmético: usar (se tem) ou comprar. */
  const cosmeticActions = (it: ShopItem) => {
    const equipped = equippedOf(it.kind) === it.id;
    if (owned(it))
      return (
        <ActionButton
          label={equipped ? '✔ Em uso' : 'Usar'}
          tone={NEON.green}
          disabled={equipped}
          onPress={() => report(equipBoard(it.id), `${it.name} equipado!`)}
        />
      );
    return (
      <>
        <ActionButton label={`🪙 ${it.price}`} tone={NEON.gold} disabled={coins < it.price} onPress={() => report(purchase(it.id), `${it.name} desbloqueado!`)} />
        {it.realCents ? (
          <ActionButton
            label={`${formatBRL(it.realCents)} (simulado)`}
            tone={NEON.violet}
            ghost
            small
            onPress={() => report(simulatedIap(it.id), `${it.name} desbloqueado (compra simulada)!`)}
          />
        ) : null}
      </>
    );
  };

  const byKind = (k: ItemKind) => ITEMS.filter((i) => i.kind === k);

  let body: React.ReactNode;
  if (!profile) body = <Text style={styles.empty}>Carregando perfil…</Text>;
  else if (tab === 'boards')
    body = (
      <View style={styles.grid}>
        {byKind('board').map((b, i) => (
          <Card key={b.id} index={i}>
            <View style={styles.preview}>
              <ThemedBackdrop themeId={b.id} preview />
              <View style={styles.previewIcon}>
                <AnimatedIcon glyph={b.icon} size={34} motion="float" />
              </View>
              {!owned(b) && <Text style={styles.lock}>🔒</Text>}
            </View>
            <Text style={styles.name}>{b.name}</Text>
            <Text style={styles.desc}>{b.desc}</Text>
            <View style={styles.actions}>{cosmeticActions(b)}</View>
          </Card>
        ))}
      </View>
    );
  else if (tab === 'skins')
    body = (
      <View style={styles.grid}>
        {byKind('skin').map((sk, i) => (
          <Card key={sk.id} index={i}>
            <View style={[styles.preview, styles.skinPreview]}>
              <PieceView piece={SAMPLE[0]} size={22} skin={sk.id} />
              <View style={{ width: 10 }} />
              <PieceView piece={SAMPLE[1]} size={22} skin={sk.id} />
              {!owned(sk) && <Text style={styles.lock}>🔒</Text>}
            </View>
            <Text style={styles.name}>{sk.name}</Text>
            <Text style={styles.desc}>{sk.desc}</Text>
            <View style={styles.actions}>{cosmeticActions(sk)}</View>
          </Card>
        ))}
      </View>
    );
  else if (tab === 'fx')
    body = (
      <View>
        {byKind('fx').map((f, i) => (
          <Card key={f.id} index={i} row>
            <AnimatedIcon glyph={f.icon} size={32} motion="pulse" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>
                {f.name} {!owned(f) && '🔒'}
              </Text>
              <Text style={styles.desc}>{f.desc}</Text>
            </View>
            <View style={styles.actionsCol}>{cosmeticActions(f)}</View>
          </Card>
        ))}
        <Text style={styles.hint}>O efeito aparece toda vez que você completa linhas.</Text>
      </View>
    );
  else if (tab === 'powerups')
    body = (
      <View>
        <Text style={styles.section}>⚡ POWER-UPS (OFFLINE E ONLINE)</Text>
        {byKind('consumable')
          .filter((p) => !p.battle)
          .map((p, i) => (
            <PowerRow key={p.id} index={i} item={p} have={profile.inventory[p.id] ?? 0} coins={coins} onBuy={() => report(purchase(p.id), `${p.name} comprado!`)} />
          ))}
        <Text style={[styles.section, { color: '#fda4af' }]}>⚔️ ATAQUES (SÓ NA BATALHA ONLINE)</Text>
        {byKind('consumable')
          .filter((p) => p.battle)
          .map((p, i) => (
            <PowerRow key={p.id} index={i + 5} item={p} have={profile.inventory[p.id] ?? 0} coins={coins} onBuy={() => report(purchase(p.id), `${p.name} comprado!`)} />
          ))}
        <Text style={styles.hint}>Toque no item na barra abaixo do tabuleiro para usar. Bombas abrem a mira.</Text>
      </View>
    );
  else
    body = (
      <View>
        <Text style={styles.section}>📦 PACOTES COM DESCONTO</Text>
        {byKind('bundle').map((b, i) => (
          <Card key={b.id} index={i} row>
            <AnimatedIcon glyph={b.icon} size={34} motion="wiggle" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{b.name}</Text>
              <Text style={styles.desc}>{b.desc}</Text>
              <Text style={styles.grants}>
                {Object.entries(b.grants ?? {})
                  .map(([id, n]) => `${itemById(id)?.icon ?? ''}×${n}`)
                  .join('  ')}
              </Text>
            </View>
            <ActionButton label={`🪙 ${b.price}`} tone={NEON.gold} disabled={coins < b.price} onPress={() => report(purchase(b.id), `${b.name} comprado!`)} />
          </Card>
        ))}
        <Text style={styles.section}>🪙 MOEDAS</Text>
        {COIN_PACKS.map((pk, i) => (
          <Card key={pk.id} index={i + 2} row>
            <AnimatedIcon glyph={pk.icon} size={34} motion="pulse" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{pk.coins} moedas</Text>
              <Text style={styles.desc}>Compra simulada — sem cobrança real.</Text>
            </View>
            <ActionButton label={formatBRL(pk.realCents)} tone={NEON.violet} onPress={() => report(simulatedIap(pk.id), `+${pk.coins} moedas!`)} />
          </Card>
        ))}
        <Text style={styles.hint}>Você também ganha moedas jogando: 1 moeda a cada 20 pontos (solo e batalha).</Text>
      </View>
    );

  return (
    <GlassModal visible={visible} onClose={onClose} title="LOJA" icon="🛒" tone={NEON.gold} header={header}>
      {body}
    </GlassModal>
  );
}

function PowerRow({ item, have, coins, onBuy, index }: { item: ShopItem; have: number; coins: number; onBuy: () => Promise<void>; index: number }) {
  return (
    <Card index={index} row>
      <AnimatedIcon glyph={item.icon} size={32} motion="wiggle" />
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
    Animated.timing(enter, { toValue: 1, duration: 380, delay: Math.min(index, 8) * 60, useNativeDriver: USE_NATIVE_DRIVER }).start();
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
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.1)' },
  tabOn: { backgroundColor: alpha('#38bdf8', 0.3), borderWidth: 1, borderColor: alpha('#38bdf8', 0.7) },
  tabText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { borderRadius: 16, padding: 10, marginBottom: 10 },
  cardGrid: { width: '48.5%', minWidth: 140 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { height: 90, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  skinPreview: { flexDirection: 'row', backgroundColor: '#0b1324' },
  previewIcon: { position: 'absolute' },
  lock: { position: 'absolute', top: 4, right: 6, fontSize: 14 },
  name: { color: '#fff', fontWeight: '900', fontSize: 14 },
  have: { color: NEON.gold, fontSize: 13 },
  desc: { color: COLORS.muted, fontSize: 11.5, marginTop: 2, marginBottom: 8 },
  grants: { color: '#e2e8f0', fontSize: 13, fontWeight: '800', marginTop: -4 },
  actions: { alignItems: 'stretch', gap: 6 },
  actionsCol: { alignItems: 'stretch', gap: 6, marginLeft: 8 },
  section: { color: '#a5b4fc', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.5, marginTop: 4, marginBottom: 8 },
  hint: { color: COLORS.muted, fontSize: 11.5, textAlign: 'center', marginTop: 4 },
  empty: { color: COLORS.muted, textAlign: 'center', padding: 24 },
});
