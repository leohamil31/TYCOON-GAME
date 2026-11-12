import { BLOCK_COLORS, GAME } from '../constants';
import type { Coord, Grid, Piece } from '../types';

const N = GAME.GRID_SIZE;

const parse = (rows: string[]): Coord[] => {
  const out: Coord[] = [];
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '#') out.push([r, c]);
    }),
  );
  return out;
};

const normalize = (cells: Coord[]): Coord[] => {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([r, c]) => [r - minR, c - minC] as Coord)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};

const rotate = (cells: Coord[]): Coord[] => {
  const maxR = Math.max(...cells.map((c) => c[0]));
  return normalize(cells.map(([r, c]) => [c, maxR - r] as Coord));
};

const mirror = (cells: Coord[]): Coord[] => {
  const maxC = Math.max(...cells.map((c) => c[1]));
  return normalize(cells.map(([r, c]) => [r, maxC - c] as Coord));
};

const BASE_SHAPES: string[][] = [
  ['#'],
  ['##'],
  ['###'],
  ['####'],
  ['#####'],
  ['##', '##'],
  ['###', '###'],
  ['###', '###', '###'],
  ['#.', '##'],
  ['#.', '#.', '##'],
  ['###', '#..', '#..'],
  ['###', '.#.'],
  ['##.', '.##'],
];

/** Every unique rotation/mirror of each base shape. */
export const SHAPES: Coord[][] = (() => {
  const seen = new Set<string>();
  const out: Coord[][] = [];
  for (const base of BASE_SHAPES) {
    const shape = normalize(parse(base));
    for (const flip of [false, true]) {
      let s = flip ? mirror(shape) : shape;
      for (let i = 0; i < 4; i++) {
        const key = JSON.stringify(s);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(s);
        }
        s = rotate(s);
      }
    }
  }
  return out;
})();

export const pieceDims = (p: Piece) => ({
  rows: Math.max(...p.cells.map((c) => c[0])) + 1,
  cols: Math.max(...p.cells.map((c) => c[1])) + 1,
});

export const emptyGrid = (): Grid =>
  Array.from({ length: N }, () => Array<number | null>(N).fill(null));

let nextId = 1;

export const canPlace = (grid: Grid, piece: Piece, r: number, c: number): boolean =>
  piece.cells.every(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr][cc] === null;
  });

export const anyMoves = (grid: Grid, pieces: (Piece | null)[]): boolean =>
  pieces.some((p) => {
    if (!p) return false;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (canPlace(grid, p, r, c)) return true;
    return false;
  });

const fits = (grid: Grid, cells: Coord[]): boolean => {
  const p = { id: 0, cells, color: 0 };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (canPlace(grid, p, r, c)) return true;
  return false;
};

const fillRatio = (grid: Grid): number =>
  grid.reduce((a, row) => a + row.filter((v) => v !== null).length, 0) / (N * N);

/** Bigger shapes are rarer, and rarer still as the board fills up. */
const shapeWeight = (cells: Coord[], fill: number): number => {
  const size = cells.length;
  const base = size <= 2 ? 1.2 : size <= 4 ? 1.5 : size <= 5 ? 1 : 0.55;
  return Math.max(0.05, base * (1 - fill * (size - 1) * 0.18));
};

const pickWeighted = (cands: Coord[][], fill: number): Coord[] => {
  const w = cands.map((s) => shapeWeight(s, fill));
  let t = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) {
    t -= w[i];
    if (t <= 0) return cands[i];
  }
  return cands[cands.length - 1];
};

/** Searches for an ordering in which all pieces fit, stopping at the shared node budget. */
const solvable = (grid: Grid, pieces: Piece[], budget: { remaining: number }): boolean => {
  if (pieces.length === 0) return true;
  for (let i = 0; i < pieces.length; i++) {
    const rest = pieces.filter((_, j) => j !== i);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (budget.remaining === 0) return false;
        if (!canPlace(grid, pieces[i], r, c)) continue;
        budget.remaining--;
        const next = grid.map((row) => [...row]);
        pieces[i].cells.forEach(([dr, dc]) => (next[r + dr][c + dc] = 0));
        if (solvable(next, rest, budget)) return true;
      }
    }
  }
  return false;
};

/**
 * Deals pieces that fit the current board: every piece has a spot, shapes are
 * weighted by size/fill, and tries a bounded search for a playable ordering.
 */
export const dealPieces = (grid: Grid): Piece[] => {
  const fill = fillRatio(grid);
  const playable = SHAPES.filter((s) => fits(grid, s));
  const pool = playable.length > 0 ? playable : [[[0, 0]] as Coord[]];
  const count = GAME.PIECES_PER_DEAL;
  const colors = [...BLOCK_COLORS.keys()].sort(() => Math.random() - 0.5);

  const build = (): Piece[] => {
    const used = new Set<Coord[]>();
    return Array.from({ length: count }, (_, i) => {
      const fresh = pool.filter((s) => !used.has(s));
      const cells = pickWeighted(fresh.length > 0 ? fresh : pool, fill);
      used.add(cells);
      return { id: nextId++, cells, color: colors[i % colors.length] };
    });
  };

  let best = build();
  for (let i = 0; i < 8; i++) {
    if (solvable(grid, best, { remaining: 2500 })) return best;
    best = build();
  }
  return best;
};

export interface ClearedCell {
  r: number;
  c: number;
  color: number;
}

export interface PlaceResult {
  grid: Grid;
  lines: number;
  placed: number;
  cleared: ClearedCell[];
  perfect: boolean;
  /** Linhas/colunas completadas por esta jogada (para os efeitos visuais). */
  rows: number[];
  cols: number[];
}

export const placePiece = (grid: Grid, piece: Piece, r: number, c: number): PlaceResult => {
  const next = grid.map((row) => [...row]);
  piece.cells.forEach(([dr, dc]) => {
    next[r + dr][c + dc] = piece.color;
  });
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let i = 0; i < N; i++) {
    if (next[i].every((v) => v !== null)) fullRows.push(i);
    if (next.every((row) => row[i] !== null)) fullCols.push(i);
  }
  const cleared: ClearedCell[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = next[i][j];
      if (v !== null && (fullRows.includes(i) || fullCols.includes(j))) {
        cleared.push({ r: i, c: j, color: v });
      }
    }
  }
  cleared.forEach(({ r: i, c: j }) => (next[i][j] = null));
  return {
    grid: next,
    lines: fullRows.length + fullCols.length,
    placed: piece.cells.length,
    cleared,
    perfect: cleared.length > 0 && next.every((row) => row.every((v) => v === null)),
    rows: fullRows,
    cols: fullCols,
  };
};

/** `combo` is the streak of consecutive line-clearing moves, already including this one. */
export const scoreFor = (
  { lines, placed, perfect }: Pick<PlaceResult, 'lines' | 'placed' | 'perfect'>,
  combo: number,
): number => placed + lines * lines * 10 * Math.max(1, combo) + (perfect ? 100 : 0);

/** Nearest legal anchor within one cell of the desired one, so drops feel forgiving. */
export const snapPlacement = (
  grid: Grid,
  piece: Piece,
  r: number,
  c: number,
): { r: number; c: number } | null => {
  let best: { r: number; c: number; d: number } | null = null;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!canPlace(grid, piece, r + dr, c + dc)) continue;
      const d = Math.abs(dr) + Math.abs(dc);
      if (!best || d < best.d) best = { r: r + dr, c: c + dc, d };
    }
  }
  return best && { r: best.r, c: best.c };
};

const CENTER_LO = Math.floor((N - 4) / 2);
const CENTER_HI = CENTER_LO + 3;
const inCenter = (r: number, c: number) => r >= CENTER_LO && r <= CENTER_HI && c >= CENTER_LO && c <= CENTER_HI;

/** Frees the central 4x4 area; used when the player continues after game over. */
export const clearCenter = (grid: Grid): Grid => grid.map((row, r) => row.map((v, c) => (inCenter(r, c) ? null : v)));

/** Blocks that `clearCenter` would remove (for the explosion effect). */
export const centerBlocks = (grid: Grid): ClearedCell[] => {
  const out: ClearedCell[] = [];
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== null && inCenter(r, c)) out.push({ r, c, color: v });
    }),
  );
  return out;
};

/** Fraction of the board that is filled (0..1). */
export const fillOf = (grid: Grid): number => fillRatio(grid);

/** True if the piece fits somewhere on the board. */
export const pieceFits = (grid: Grid, piece: Piece): boolean => fits(grid, piece.cells);
