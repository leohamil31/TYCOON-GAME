import { anyMoves, blastArea, canPlace, centerBlocks, clampAim, clearCenter, dealPieces, dropGarbage, emptyGrid, garbageFor, placePiece, rubbleArea, scoreFor, snapPlacement } from '../src/game/engine';
import { GARBAGE } from '../src/constants';
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

  test('peças nunca usam a cor de entulho', () => {
    for (let i = 0; i < 40; i++) dealPieces(emptyGrid()).forEach((p) => expect(p.color).not.toBe(GARBAGE));
  });

  test('bomba mirada explode só a área 3x3', () => {
    let g = emptyGrid();
    g = placePiece(g, line(5), 2, 0).grid;
    const { grid, hit } = blastArea(g, 2, 1);
    expect(hit).toHaveLength(3); // casas (2,0) (2,1) (2,2)
    expect(grid[2][3]).not.toBeNull();
    expect(grid[2][1]).toBeNull();
  });

  test('entulho preenche só casas vazias da área', () => {
    const g = placePiece(emptyGrid(), line(1), 5, 5).grid;
    const { grid, added } = rubbleArea(g, 5, 5);
    expect(added).toHaveLength(8);
    expect(grid[5][5]).toBe(0);
    expect(grid[4][4]).toBe(GARBAGE);
  });

  test('lixo nunca completa linha nem coluna', () => {
    for (let k = 0; k < 20; k++) {
      let g = emptyGrid();
      g = placePiece(g, line(5), 0, 0).grid;
      g = placePiece(g, { ...line(4), id: 2 }, 0, 5).grid; // linha 0 com 1 casa livre
      const { grid, added } = dropGarbage(g, 8);
      expect(added.length).toBeLessThanOrEqual(8);
      expect(grid[0][9]).toBeNull();
      for (let i = 0; i < 10; i++) {
        expect(grid[i].every((v) => v !== null)).toBe(false);
        expect(grid.every((row) => row[i] !== null)).toBe(false);
      }
    }
  });

  test('mira fica dentro do tabuleiro e combos geram lixo', () => {
    expect(clampAim(0, 9.7)).toEqual({ r: 1, c: 8 });
    expect(garbageFor(1, 1)).toBe(0);
    expect(garbageFor(2, 1)).toBe(2);
    expect(garbageFor(4, 3)).toBe(8);
  });
});
