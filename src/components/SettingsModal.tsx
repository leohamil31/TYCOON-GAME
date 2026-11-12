import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { cleanPlayerName } from '../shop/types';
import { useProfile } from '../state/useProfile';
import { getSfxSettings, haptic, onSfxSettings, play, setSfxSettings } from '../services/sfx';
import { saveName } from '../storage';
import { alpha, NEON } from '../theme';
import { ActionButton, Banner, GlassModal } from './GlassModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenShop: () => void;
}

/** Configurações: nome do jogador, código de amigo e atalho para trocar o tabuleiro. */
export function SettingsModal({ visible, onClose, onOpenShop }: Props) {
  const { profile, mode, rename } = useProfile();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const [sfx, setSfx] = useState(getSfxSettings);
  useEffect(() => onSfxSettings(() => setSfx(getSfxSettings())), []);

  useEffect(() => {
    if (visible) {
      setName(profile?.name ?? '');
      setMsg(null);
    }
  }, [visible, profile?.name]);

  const save = async () => {
    const clean = cleanPlayerName(name);
    const err = await rename(clean);
    if (err) return setMsg({ text: err, kind: 'error' });
    await saveName(clean).catch(() => undefined);
    setMsg({ text: 'Nome atualizado!', kind: 'ok' });
  };

  return (
    <GlassModal visible={visible} onClose={onClose} title="CONFIGURAÇÕES" icon="⚙️" iconMotion="spin" tone={NEON.violet}>
      {mode === 'local' && <Banner text="Modo demonstração: dados salvos só neste aparelho." />}
      {msg && <Banner text={msg.text} kind={msg.kind} />}
      <Text style={styles.label}>NOME DO JOGADOR</Text>
      <View style={styles.row}>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={16}
          placeholder="Seu nome"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <View style={{ width: 10 }} />
        <ActionButton label="Salvar" tone={NEON.violet} onPress={save} disabled={!name.trim()} />
      </View>
      <Text style={styles.label}>CÓDIGO DE AMIGO</Text>
      <Text style={styles.code}>{profile?.userId ?? '—'}</Text>
      <Text style={styles.label}>SOM E VIBRAÇÃO</Text>
      <View style={styles.row}>
        <ActionButton
          label={sfx.sound ? '🔊 Som ligado' : '🔇 Som desligado'}
          tone={sfx.sound ? NEON.green : '#94a3b8'}
          ghost={!sfx.sound}
          onPress={() => {
            setSfxSettings({ sound: !sfx.sound });
            if (!sfx.sound) play('coin');
          }}
        />
        <View style={{ width: 10 }} />
        <ActionButton
          label={sfx.haptics ? '📳 Vibração ligada' : '📴 Vibração desligada'}
          tone={sfx.haptics ? NEON.green : '#94a3b8'}
          ghost={!sfx.haptics}
          onPress={() => {
            setSfxSettings({ haptics: !sfx.haptics });
            if (!sfx.haptics) haptic('medium');
          }}
        />
      </View>
      <View style={{ marginTop: 16 }}>
        <ActionButton
          label="🎨 Trocar tabuleiro"
          tone={NEON.cyan}
          ghost
          onPress={() => {
            onClose();
            onOpenShop();
          }}
        />
      </View>
    </GlassModal>
  );
}

const styles = StyleSheet.create({
  label: { color: '#94a3b8', fontSize: 11, letterSpacing: 2, fontWeight: '800', marginTop: 8, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 48,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: alpha('#a78bfa', 0.4),
    backgroundColor: 'rgba(2,6,23,0.5)',
  },
  code: { color: '#f8fafc', fontSize: 22, fontWeight: '900', letterSpacing: 4 },
});
