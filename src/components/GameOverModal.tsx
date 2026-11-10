import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants';
import { showRewardedAd } from '../services/ads';

interface Props {
  visible: boolean;
  score: number;
  best: number;
  canRevive: boolean;
  adsRemoved: boolean;
  onRevive: () => void;
  onRestart: () => void;
  /** Escudos no inventário e ação para usar um. */
  shields?: number;
  onShield?: () => void;
}

export function GameOverModal({
  visible,
  score,
  best,
  canRevive,
  adsRemoved,
  onRevive,
  onRestart,
  shields = 0,
  onShield,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const isRecord = score > 0 && score >= best;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRestart}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Fim de jogo!</Text>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.sub}>{isRecord ? '🏆 Novo recorde!' : `Recorde: ${best}`}</Text>

          {shields > 0 && onShield && (
            <Pressable style={styles.shield} onPress={onShield} disabled={loading}>
              <Text style={styles.shieldLabel}>🛡️ Usar escudo ({shields})</Text>
            </Pressable>
          )}
          {canRevive && (
            <Pressable style={styles.primary} onPress={revive} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.primaryLabel}>
                  {adsRemoved ? '💥 Continuar' : '📺 Assistir anúncio e continuar'}
                </Text>
              )}
            </Pressable>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.secondary} onPress={onRestart} disabled={loading}>
            <Text style={styles.secondaryLabel}>Jogar de novo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 24,
    alignItems: 'center',
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  score: { color: COLORS.accent, fontSize: 56, fontWeight: '900', marginTop: 8 },
  sub: { color: COLORS.muted, marginBottom: 16 },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryLabel: { color: '#052e16', fontWeight: '900', fontSize: 15 },
  shield: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#a78bfa',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  shieldLabel: { color: '#1e1b4b', fontWeight: '900', fontSize: 15 },
  secondary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
    backgroundColor: COLORS.accent,
  },
  secondaryLabel: { color: COLORS.background, fontWeight: '900', fontSize: 15 },
  error: { color: COLORS.danger, marginTop: 8, textAlign: 'center', fontSize: 12 },
});
