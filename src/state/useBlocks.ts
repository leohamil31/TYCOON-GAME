import { useCallback, useEffect, useRef, useState } from 'react';
import {
  anyMoves,
  canPlace,
  clearCenter,
  dealPieces,
  emptyGrid,
  placePiece,
  scoreFor,
} from '../game/engine';
import { loadGame, saveGame } from '../storage';
import { BOOST_MOVES } from '../shop/catalog';
import type { ClearFx, GameState, SaveData } from '../types';

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

export function useBlocks(mode: GameMode = 'solo') {
  const [state, setState] = useState<GameState | null>(null);
  const [fx, setFx] = useState<ClearFx | null>(null);
  const [boost, setBoost] = useState(0);
  const ref = useRef<GameState | null>(null);
  ref.current = state;
  const boostRef = useRef(0);
  boostRef.current = boost;
  const fxId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadGame().then((s) => {
      if (cancelled) return;
      // Battles always start from a clean board; the saved game is only read for the record / ads flag.
      const initial = mode === 'solo' ? (s ?? newGame(0, false)) : newGame(s?.best ?? 0, s?.adsRemoved ?? false);
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

  const place = useCallback((index: number, r: number, c: number) => {
    const s = ref.current;
    const piece = s?.pieces[index];
    if (!s || s.status !== 'playing' || !piece || !canPlace(s.grid, piece, r, c)) return;
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
    if (res.lines > 0) {
      setFx({
        id: ++fxId.current,
        lines: res.lines,
        combo,
        points,
        perfect: res.perfect,
        cleared: res.cleared,
      });
    }
  }, []);

  const restart = useCallback(() => {
    const s = ref.current;
    setFx(null);
    setBoost(0);
    if (s) setState({ ...newGame(s.best, s.adsRemoved), hydrated: true });
  }, []);

  const revive = useCallback(() => {
    const s = ref.current;
    if (!s) return;
    const grid = clearCenter(s.grid);
    setState({ ...s, grid, pieces: dealPieces(grid), revived: true, status: 'playing' });
  }, []);

  /** Escudo: como o revive, mas sem gastar o revive por anúncio. */
  const shield = useCallback(() => {
    const s = ref.current;
    if (!s) return;
    const grid = clearCenter(s.grid);
    setState({ ...s, grid, pieces: dealPieces(grid), status: 'playing' });
  }, []);

  const bomb = useCallback(() => {
    const s = ref.current;
    if (!s || s.status !== 'playing') return;
    const grid = clearCenter(s.grid);
    setState({ ...s, grid, status: anyMoves(grid, s.pieces) ? 'playing' : 'over' });
  }, []);

  const activateBoost = useCallback(() => setBoost(BOOST_MOVES), []);

  const setAdsRemoved = useCallback(() => {
    setState((s) => (s && !s.adsRemoved ? { ...s, adsRemoved: true } : s));
  }, []);

  return { state, fx, boost, place, restart, revive, shield, bomb, activateBoost, setAdsRemoved };
}
