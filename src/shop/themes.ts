import { COLORS } from '../constants';
import { DEFAULT_BOARD } from './catalog';

/** Cores do tabuleiro de cada tema (o fundo animado fica em components/ThemedBackdrop). */
export interface BoardTheme {
  id: string;
  board: string;
  cell: string;
  cellAlt: string;
  frameTop: string;
  frameSide: string;
  glow: string;
}

export const THEMES: Record<string, BoardTheme> = {
  classic: {
    id: 'classic',
    board: '#142036',
    cell: COLORS.cell,
    cellAlt: '#1b2940',
    frameTop: 'rgba(148,197,255,0.45)',
    frameSide: 'rgba(148,197,255,0.3)',
    glow: '#000',
  },
  neon: {
    id: 'neon',
    board: '#1a0b33',
    cell: '#25104a',
    cellAlt: '#2e1560',
    frameTop: '#f472b6',
    frameSide: '#a855f7',
    glow: '#f472b6',
  },
  space: {
    id: 'space',
    board: '#0c1630',
    cell: '#111d3b',
    cellAlt: '#16254a',
    frameTop: '#a5b4fc',
    frameSide: '#6366f1',
    glow: '#818cf8',
  },
  cyber: {
    id: 'cyber',
    board: '#160a22',
    cell: '#1d0f2c',
    cellAlt: '#251238',
    frameTop: '#22d3ee',
    frameSide: '#e879f9',
    glow: '#22d3ee',
  },
};

export const themeFor = (id: string | undefined): BoardTheme => THEMES[id ?? DEFAULT_BOARD] ?? THEMES[DEFAULT_BOARD];
