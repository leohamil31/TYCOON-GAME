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
    board: '#0d1628',
    cell: COLORS.cell,
    cellAlt: '#1b2940',
    // Sempre #hex: alpha() só entende hex.
    frameTop: '#7dd3fc',
    frameSide: '#3b82f6',
    glow: '#38bdf8',
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
  aurora: {
    id: 'aurora',
    board: '#071a22',
    cell: '#0b2530',
    cellAlt: '#0e2d3a',
    frameTop: '#6ee7b7',
    frameSide: '#a78bfa',
    glow: '#34d399',
  },
  abyss: {
    id: 'abyss',
    board: '#041526',
    cell: '#071f36',
    cellAlt: '#0a2742',
    frameTop: '#67e8f9',
    frameSide: '#3b82f6',
    glow: '#22d3ee',
  },
  ember: {
    id: 'ember',
    board: '#1c0d08',
    cell: '#26120b',
    cellAlt: '#2f170e',
    frameTop: '#fdba74',
    frameSide: '#ef4444',
    glow: '#f97316',
  },
};

export const themeFor = (id: string | undefined): BoardTheme => THEMES[id ?? DEFAULT_BOARD] ?? THEMES[DEFAULT_BOARD];
