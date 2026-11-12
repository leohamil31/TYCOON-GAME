import { useCallback, useEffect, useRef, useState } from 'react';
import {
  anyMoves,
  canPlace,
  centerBlocks,
  clearCenter,
  dealPieces,
  emptyGrid,
  placePiece,
  scoreFor,
} from '../game/engine';
import { loadGame, saveGame } from '../storage';
import { BOOST_MOVES } from '../shop/catalog';
import type { ClearFx, GameState, PlacedFx, SaveData } from '../types';

const newGame = (best: number, adsRemoved: boolean): SaveData => {
  const grid = emptyGrid();
  return {
    grid,
    pieces: dealPieces(grid),
    score: 0,
    best,
    revived: false,
    status: 'playing',
    adsRemoved,
    combo: 0,
  };
};

export type GameMode = 'solo' | 'battle';

/** Estado salvo antes da última jogada (power-up "Desfazer"). */
interface UndoPoint {
  save: SaveData;
  boost: number;
}

export function useBlocks(mode: GameMode = 'solo', locked = false) {
  const [state, setState] = useState<GameState | null>(null);
  const [fx, setFx] = useState<ClearFx | null>(null);
  const [placed, setPlaced] = useState<PlacedFx | null>(null);
  const [boost, setBoost] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  /** Recorde no início da partida (para saber se o jogador bateu o recorde). */
  const [startBest, setStartBest] = useState(0);

  const ref = useRef<GameState | null>(null);
  ref.current = state;
  const boostRef = useRef(0);
  boostRef.current = boost;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const fxId = useRef(0);
  const undo = useRef<UndoPoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGame().then((s) => {
      if (cancelled) return;
      // Battles always start from a clean board; the saved game is only read for the record / ads flag.
      const initial = mode === 'solo' ? (s ?? newGame(0, false)) : newGame(s?.best ?? 0, s?.adsRemoved ?? false);
      setStartBest(initial.best);
      setState({ ...initial, hydrated: true });
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!state || mode !== 'solo') return;
    const { hydrated: _h, ...save } = state;
    void saveGame(save);
  }, [state, mode]);

  const snapshotFor = (s: GameState): SaveData => {
    const { hydrated: _h, ...save } = s;
    return save;
  };

  const place = useCallback((index: number, r: number, c: number): boolean => {
    const s = ref.current;
    const piece = s?.pieces[index];
    if (lockedRef.current || !s || s.status !== 'playing' || !piece || !canPlace(s.grid, piece, r, c)) return false;
    undo.current = { save: snapshotFor(s), boost: boostRef.current };
    setCanUndo(true);

    const res = placePiece(s.grid, piece, r, c);
    const combo = res.lines > 0 ? s.combo + 1 : 0;
    const boosted = boostRef.current > 0;
    const points = scoreFor(res, combo) * (boosted ? 2 : 1);
    if (boosted) setBoost((b) => Math.max(0, b - 1));
    let pieces = s.pieces.map((p, i) => (i === index ? null : p));
    if (pieces.every((p) => p === null)) pieces = dealPieces(res.grid);
    const score = s.score + points;
    setState({
      ...s,
      grid: res.grid,
      pieces,
      score,
      combo,
      best: Math.max(s.best, score),
      status: anyMoves(res.grid, pieces) ? 'playing' : 'over',
    });
    const id = ++fxId.current;
    setPlaced({ id, cells: piece.cells.map(([dr, dc]) => [r + dr, c + dc]), points });
    if (res.lines > 0) {
      setFx({
        id,
        kind: 'clear',
        lines: res.lines,
        combo,
        points,
        perfect: res.perfect,
        boosted,
        cleared: res.cleared,
        rows: res.rows,
        cols: res.cols,
      });
    }
    return true;
  }, []);

  const restart = useCallback(() => {
    const s = ref.current;
    setFx(null);
    setPlaced(null);
    setBoost(0);
    undo.current = null;
    setCanUndo(false);
    if (s) {
      setStartBest(s.best);
      setState({ ...newGame(s.best, s.adsRemoved), hydrated: true });
    }
  }, []);

  /** Libera o centro e dá novas peças. `useRevive` marca o revive por anúncio como gasto. */
  const rescue = (useRevive: boolean) => {
    const s = ref.current;
    if (!s) return;
    const blocks = centerBlocks(s.grid);
    const grid = clearCenter(s.grid);
    undo.current = null;
    setCanUndo(false);
    setState({ ...s, grid, pieces: dealPieces(grid), revived: useRevive ? true : s.revived, status: 'playing' });
    if (blocks.length > 0) {
      setFx({
        id: ++fxId.current,
        kind: 'bomb',
        lines: 0,
        combo: 0,
        points: 0,
        perfect: false,
        boosted: false,
        cleared: blocks,
        rows: [],
        cols: [],
      });
    }
  };

  const revive = useCallback(() => rescue(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Escudo: como o revive, mas sem gastar o revive por anúncio. */
  const shield = useCallback(() => rescue(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Bomba: explode o centro 4x4. Vale 2 pontos por bloco destruído. */
  const bomb = useCallback((): boolean => {
    const s = ref.current;
    // Também funciona sem jogadas: abrir o centro pode salvar a partida.
    if (lockedRef.current || !s) return false;
    const blocks = centerBlocks(s.grid);
    if (blocks.length === 0) return false;
    const grid = clearCenter(s.grid);
    const points = blocks.length * 2;
    const score = s.score + points;
    undo.current = null;
    setCanUndo(false);
    setState({
      ...s,
      grid,
      score,
      best: Math.max(s.best, score),
      status: anyMoves(grid, s.pieces) ? 'playing' : 'over',
    });
    setFx({
      id: ++fxId.current,
      kind: 'bomb',
      lines: 0,
      combo: s.combo,
      points,
      perfect: false,
      boosted: false,
      cleared: blocks,
      rows: [],
      cols: [],
    });
    return true;
  }, []);

  /** Nova Mão: troca as peças da bandeja por outras que cabem no tabuleiro. */
  const reroll = useCallback((): boolean => {
    const s = ref.current;
    if (lockedRef.current || !s) return false;
    const pieces = dealPieces(s.grid);
    setState({ ...s, pieces, status: anyMoves(s.grid, pieces) ? 'playing' : 'over' });
    return true;
  }, []);

  /** Desfazer: volta para antes da última peça colocada. */
  const undoMove = useCallback((): boolean => {
    const u = undo.current;
    if (lockedRef.current || !u) return false;
    undo.current = null;
    setCanUndo(false);
    setFx(null);
    setPlaced(null);
    setBoost(u.boost);
    setState((s) => ({ ...u.save, best: Math.max(u.save.best, s?.best ?? 0), revived: s?.revived ?? u.save.revived, hydrated: true }));
    return true;
  }, []);

  const activateBoost = useCallback(() => setBoost(BOOST_MOVES), []);

  const setAdsRemoved = useCallback(() => {
    setState((s) => (s && !s.adsRemoved ? { ...s, adsRemoved: true } : s));
  }, []);

  return {
    state,
    fx,
    placed,
    boost,
    canUndo,
    startBest,
    place,
    restart,
    revive,
    shield,
    bomb,
    reroll,
    undoMove,
    activateBoost,
    setAdsRemoved,
  };
}
