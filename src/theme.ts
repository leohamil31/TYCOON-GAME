import { Platform, type ViewStyle } from 'react-native';

/** '#rrggbb' + alpha (0..1) -> rgba() string. */
export const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Frosted-glass panel look. backdrop-filter only exists on web; native just gets the translucent fill. */
export const glass: ViewStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  borderWidth: 1,
  borderColor: 'rgba(186, 230, 253, 0.18)',
  borderTopColor: 'rgba(255, 255, 255, 0.32)',
  ...(Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as unknown as ViewStyle)
    : null),
};

/** Paleta dark: preto profundo + cobalto, ciano e roxo elétrico. */
export const PALETTE = {
  void: '#04060f',
  deep: '#070b1c',
  cobalt: '#2563eb',
  electric: '#7c3aed',
  cyan: '#22d3ee',
} as const;

const isWeb = Platform.OS === 'web';

/** Gradiente CSS (só web); no nativo cai para a cor sólida `fallback`. */
export const gradient = (angle: number, stops: string[], fallback: string): ViewStyle =>
  isWeb
    ? ({ backgroundImage: `linear-gradient(${angle}deg, ${stops.join(', ')})` } as unknown as ViewStyle)
    : { backgroundColor: fallback };

/** Vidro "forte": blur maior, borda superior brilhante e sombra profunda. */
export const glassStrong: ViewStyle = {
  backgroundColor: 'rgba(10, 16, 38, 0.62)',
  borderWidth: 1,
  borderColor: 'rgba(148, 197, 255, 0.16)',
  borderTopColor: 'rgba(255, 255, 255, 0.38)',
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
  ...(isWeb
    ? ({
        backdropFilter: 'blur(22px) saturate(160%)',
        WebkitBackdropFilter: 'blur(22px) saturate(160%)',
      } as unknown as ViewStyle)
    : null),
};

export const NEON = {
  cyan: '#22d3ee',
  pink: '#f472b6',
  gold: '#facc15',
  green: '#22c55e',
  violet: '#a78bfa',
} as const;

/** Native driver is not available on react-native-web. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
