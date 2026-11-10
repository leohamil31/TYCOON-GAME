import AsyncStorage from '@react-native-async-storage/async-storage';
import { BLOCK_COLORS, GAME } from './constants';
import type { Coord, Grid, Piece, SaveData, ScoreEntry } from './types';

const N = GAME.GRID_SIZE;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

const validGrid = (g: unknown): g is Grid =>
  Array.isArray(g) &&
  g.length === N &&
  g.every(
    (row) =>
      Array.isArray(row) &&
      row.length === N &&
      row.every((v) => v === null || (isNum(v) && v < BLOCK_COLORS.length)),
  );

const validPiece = (p: unknown): p is Piece => {
  const x = p as Piece;
  return (
    !!x &&
    isNum(x.id) &&
    isNum(x.color) &&
    x.color < BLOCK_COLORS.length &&
    Array.isArray(x.cells) &&
    x.cells.length > 0 &&
    x.cells.every((c: Coord) => Array.isArray(c) && isNum(c[0]) && isNum(c[1]) && c[0] < 5 && c[1] < 5)
  );
};

const parse = (raw: string): SaveData | null => {
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (!validGrid(d.grid) || !Array.isArray(d.pieces) || d.pieces.length !== GAME.PIECES_PER_DEAL) return null;
    if (!d.pieces.every((p) => p === null || validPiece(p))) return null;
    if (!isNum(d.score) || !isNum(d.best)) return null;
    return {
      grid: d.grid,
      pieces: d.pieces as (Piece | null)[],
      score: d.score,
      best: Math.max(d.best, d.score),
      revived: d.revived === true,
      status: d.status === 'over' ? 'over' : 'playing',
      adsRemoved: d.adsRemoved === true,
      combo: isNum(d.combo) ? Math.floor(d.combo) : 0,
    };
  } catch {
    return null;
  }
};

export async function loadGame(): Promise<SaveData | null> {
  try {
    const raw = await AsyncStorage.getItem(GAME.STORAGE_KEY);
    return raw ? parse(raw) : null;
  } catch (e) {
    console.warn('[storage] load failed', e);
    return null;
  }
}

export async function saveGame(data: SaveData): Promise<void> {
  try {
    await AsyncStorage.setItem(GAME.STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[storage] save failed', e);
  }
}

const SCORES_KEY = '@tycoon/scores_v1';
const NAME_KEY = '@tycoon/name_v1';
const MAX_SCORES = 10;
export const DEFAULT_NAME = 'Jogador';

export const cleanName = (v: unknown): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14) : '';

export async function loadName(): Promise<string> {
  try {
    return cleanName(await AsyncStorage.getItem(NAME_KEY)) || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

export async function saveName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(NAME_KEY, cleanName(name) || DEFAULT_NAME);
  } catch (e) {
    console.warn('[storage] name save failed', e);
  }
}

export async function loadScores(): Promise<ScoreEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SCORES_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (e): e is ScoreEntry =>
          !!e && isNum(e.id) && isNum(e.score) && isNum(e.date) && typeof e.name === 'string',
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

/** Records a finished game. Same game id keeps only its highest score (e.g. after a revive). */
export async function addScore(id: number, score: number): Promise<ScoreEntry[]> {
  const [list, name] = await Promise.all([loadScores(), loadName()]);
  if (score <= 0) return list;
  const existing = list.find((e) => e.id === id);
  const next = existing
    ? list.map((e) => (e.id === id ? { ...e, score: Math.max(e.score, score), name } : e))
    : [...list, { id, name, score, date: Date.now() }];
  const top = next.sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  try {
    await AsyncStorage.setItem(SCORES_KEY, JSON.stringify(top));
  } catch (e) {
    console.warn('[storage] score save failed', e);
  }
  return top;
}
