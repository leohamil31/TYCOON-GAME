import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { COLORS } from '../constants';
import { alpha, glassStrong, NEON, USE_NATIVE_DRIVER } from '../theme';
import { AnimatedIcon, type Motion } from './AnimatedIcon';

interface ModalProps {
  visible: boolean;
  title: string;
  icon: string;
  iconMotion?: Motion;
  tone?: string;
  onClose: () => void;
  /** Conteúdo fixo entre o cabeçalho e a rolagem (abas, saldo...). */
  header?: React.ReactNode;
  children: React.ReactNode;
}

/** Modal glassmorphism padrão do jogo: entra com escala/fade, fecha tocando fora, responsivo. */
export function GlassModal({ visible, title, icon, iconMotion = 'float', tone = NEON.cyan, onClose, header, children }: ModalProps) {
  const { width, height } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.2)), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [visible, enter]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        <Animated.View
          style={[
            styles.panel,
            glassStrong,
            {
              borderColor: alpha(tone, 0.4),
              maxWidth: 560,
              width: Math.min(width - 24, 560),
              maxHeight: height - 40,
              opacity: enter,
              transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <View style={styles.head}>
            <AnimatedIcon glyph={icon} size={26} motion={iconMotion} />
            <Text style={[styles.title, { textShadowColor: alpha(tone, 0.8) }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Fechar">
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>
          {header}
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface ActionProps {
  label: string;
  onPress: () => void | Promise<void>;
  tone?: string;
  disabled?: boolean;
  /** Estilo discreto (contorno) em vez de preenchido. */
  ghost?: boolean;
  small?: boolean;
}

/** Botão com micro-interação: sobe/brilha no hover, afunda ao pressionar e mostra "..." durante a ação. */
export function ActionButton({ label, onPress, tone = NEON.cyan, disabled, ghost, small }: ActionProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const to = (v: number) => Animated.spring(scale, { toValue: v, friction: 6, tension: 220, useNativeDriver: USE_NATIVE_DRIVER }).start();
  const off = disabled || busy;

  const press = async () => {
    if (off) return;
    setBusy(true);
    try {
      await onPress();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={press}
      disabled={off}
      onHoverIn={() => {
        setHover(true);
        to(1.05);
      }}
      onHoverOut={() => {
        setHover(false);
        to(1);
      }}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(hover ? 1.05 : 1)}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
    >
      <Animated.View
        style={[
          styles.btn,
          small && styles.btnSmall,
          ghost
            ? { borderColor: alpha(tone, 0.6), backgroundColor: alpha(tone, hover ? 0.2 : 0.08) }
            : { borderColor: alpha(tone, 0.9), backgroundColor: alpha(tone, hover ? 0.55 : 0.4), shadowColor: tone, shadowOpacity: hover ? 0.8 : 0.35, shadowRadius: hover ? 14 : 8, shadowOffset: { width: 0, height: 0 } },
          off && styles.btnOff,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.btnLabel, small && { fontSize: 12 }]}>{busy ? '…' : label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Faixa de aviso/erro com cor semântica. */
export function Banner({ text, kind = 'info' }: { text: string; kind?: 'info' | 'error' | 'ok' }) {
  const tone = kind === 'error' ? COLORS.danger : kind === 'ok' ? NEON.green : NEON.cyan;
  return (
    <View style={[styles.banner, { borderColor: alpha(tone, 0.5), backgroundColor: alpha(tone, 0.12) }]}>
      <Text style={[styles.bannerText, { color: tone }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.78)', alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: 24, padding: 16, overflow: 'hidden', backgroundColor: 'rgba(15,23,42,0.92)' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: {
    flex: 1,
    marginLeft: 10,
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148,163,184,0.15)' },
  closeX: { color: COLORS.muted, fontSize: 15, fontWeight: '800' },
  body: { flexGrow: 0 },
  btn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 10, minWidth: 64 },
  btnOff: { opacity: 0.4 },
  btnLabel: { color: '#fff', fontWeight: '800', fontSize: 13 },
  banner: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10 },
  bannerText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
