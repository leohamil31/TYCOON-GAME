export type Coord = [row: number, col: number];
export type Cell = number | null;
export type Grid = Cell[][];
export type Status = 'playing' | 'over';

export interface Piece {
  id: number;
  cells: Coord[];
  color: number;
}

export interface SaveData {
  grid: Grid;
  pieces: (Piece | null)[];
  score: number;
  best: number;
  revived: boolean;
  status: Status;
  adsRemoved: boolean;
  combo: number;
}

export interface ClearFx {
  id: number;
  lines: number;
  combo: number;
  points: number;
  perfect: boolean;
  cleared: { r: number; c: number; color: number }[];
}

export interface GameState extends SaveData {
  hydrated: boolean;
}

export interface ScoreEntry {
  id: number;
  name: string;
  score: number;
  date: number;
}

/** What a player broadcasts to the opponent during a battle. */
export interface Snapshot {
  score: number;
  combo: number;
  grid: Grid;
  over: boolean;
}

export interface PlayerView {
  name: string;
  score: number;
  combo: number;
  grid: Grid | null;
  over: boolean;
}

export interface BattleResult {
  outcome: 'win' | 'lose' | 'draw';
  reason: 'time' | 'out' | 'left';
  myScore: number;
  oppScore: number;
}
