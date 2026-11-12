import { Platform, type ViewStyle } from 'react-native';

/** '#rrggbb' + alpha (0..1) -> rgba() string. */
export const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const isWebPlatform = Platform.OS === 'web';

/**
 * Frosted-glass panel look. backdrop-filter only exists on web; no app nativo (sem desfoque) o fundo
 * fica mais opaco para não "lavar" o painel sobre o cenário animado.
 */
export const glass: ViewStyle = {
  backgroundColor: isWebPlatform ? 'rgba(15, 23, 42, 0.55)' : 'rgba(13, 20, 40, 0.86)',
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
  backgroundColor: isWeb ? 'rgba(10, 16, 38, 0.62)' : 'rgba(10, 16, 38, 0.9)',
  borderWidth: 1,
  borderColor: 'rgba(148, 197, 255, 0.16)',
  borderTopColor: 'rgba(255, 255, 255, 0.38)',
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  // Android: elevation em fundo translúcido desenha um retângulo escuro por trás — por isso fica sem.
  elevation: 0,
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

/** Sombra só onde fica bonita: iOS/web usam shadow*; no Android, elevation apenas em superfícies opacas. */
export const IS_ANDROID = Platform.OS === 'android';

/** Texto sem o "respiro" extra de fonte do Android (centraliza emojis e números). */
export const tightText = IS_ANDROID ? ({ includeFontPadding: false, textAlignVertical: 'center' } as const) : {};
