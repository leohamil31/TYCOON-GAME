import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { alpha, glassStrong, gradient } from '../theme';

interface Props {
  /** Cor de destaque da borda/brilho. */
  tone?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Superfície de vidro reutilizável (equivalente ao expo-glass-effect, que exige Expo):
 * blur + saturação no web, fill translúcido no nativo, borda brilhante e reflexo superior em gradiente.
 */
export function GlassSurface({ tone = '#7dd3fc', radius = 20, style, children }: Props) {
  return (
    <View style={[styles.base, glassStrong, { borderRadius: radius, borderColor: alpha(tone, 0.28) }, style]}>
      <View
        pointerEvents="none"
        style={[
          styles.sheen,
          { borderTopLeftRadius: radius, borderTopRightRadius: radius },
          gradient(180, ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'], 'rgba(255,255,255,0.05)'),
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
});
