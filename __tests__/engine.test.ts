import { anyMoves, canPlace, centerBlocks, clearCenter, dealPieces, emptyGrid, placePiece, scoreFor, snapPlacement } from '../src/game/engine';
import type { Piece } from '../src/types';

const line = (len: number): Piece => ({ id: 1, color: 0, cells: Array.from({ length: len }, (_, i) => [0, i] as [number, number]) });

describe('engine', () => {
  test('completar uma linha limpa e informa rows/cols', () => {
    let g = emptyGrid();
    g = placePiece(g, line(5), 0, 0).grid;
    const res = placePiece(g, line(5), 0, 5);
    expect(res.lines).toBe(1);
    expect(res.rows).toEqual([0]);
    expect(res.cols).toEqual([]);
    expect(res.cleared).toHaveLength(10);
    expect(res.perfect).toBe(true);
    expect(res.grid[0].every((v) => v === null)).toBe(true);
  });

  test('pontuação cresce com combo', () => {
    expect(scoreFor({ lines: 2, placed: 4, perfect: false }, 3)).toBe(4 + 4 * 10 * 3);
  });

  test('não encaixa fora do tabuleiro nem sobre blocos', () => {
    const g = placePiece(emptyGrid(), line(1), 5, 5).grid;
    expect(canPlace(g, line(1), 5, 5)).toBe(false);
    expect(canPlace(g, line(5), 0, 6)).toBe(false);
    expect(snapPlacement(g, line(1), 5, 5)).not.toBeNull();
  });

  test('bomba: centerBlocks/clearCenter', () => {
    const g = placePiece(emptyGrid(), line(4), 4, 3).grid;
    expect(centerBlocks(g)).toHaveLength(4);
    expect(centerBlocks(clearCenter(g))).toHaveLength(0);
  });

  test('peças distribuídas sempre cabem', () => {
    for (let i = 0; i < 30; i++) {
      const g = emptyGrid();
      const pieces = dealPieces(g);
      expect(pieces).toHaveLength(3);
      expect(anyMoves(g, pieces)).toBe(true);
    }
  });
});
