import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

export const COLORS = {
  background: '#0f172a',
  card: '#1e293b',
  cell: '#17233b',
  cardBorder: 'rgba(148, 163, 184, 0.18)',
  accent: '#38bdf8',
  text: '#f1f5f9',
  muted: '#94a3b8',
  danger: '#f87171',
} as const;

export const BLOCK_COLORS = [
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#38bdf8',
  '#8b5cf6',
  '#ec4899',
  '#64748b', // 7 = entulho/lixo (vem de ataques; nunca aparece nas peças)
] as const;

/** Índice de cor dos blocos de lixo/entulho enviados pelo adversário. */
export const GARBAGE = 7;
/** Cores usadas nas peças normais (0..6). */
export const PIECE_COLOR_COUNT = 7;

export const GAME = {
  GRID_SIZE: 10,
  PIECES_PER_DEAL: 3,
  STORAGE_KEY: '@serralheria_blocos/save_v1',
} as const;

export const IAP = {
  // Must match the product ID created in Google Play Console / App Store Connect.
  REMOVE_ADS_SKU: Platform.select({
    ios: 'remove_ads_permanent',
    default: 'remove_ads_permanent',
  }) as string,
};

export const ADS = {
  REWARDED_UNIT_ID: (__DEV__
    ? TestIds.REWARDED
    : Platform.select({
        ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy', // TODO: real iOS rewarded unit
        default: 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz', // TODO: real Android rewarded unit
      })) as string,
  LOAD_TIMEOUT_MS: 15000,
};
