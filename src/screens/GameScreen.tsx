import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ThemedBackdrop } from '../components/ThemedBackdrop';
import { ClearEffects } from '../components/ClearEffects';
import { GameOverModal } from '../components/GameOverModal';
import { LiveScoreboard } from '../components/LiveScoreboard';
import { Block, PieceView } from '../components/Piece';
import { ScoreHud } from '../components/ScoreHud';
import { COLORS, GAME } from '../constants';
import { pieceDims, snapPlacement } from '../game/engine';
import { initAds } from '../services/ads';
import { buyRemoveAds, disposeIap, initIap, restorePurchases } from '../services/iap';
import { themeFor } from '../shop/themes';
import { useBlocks, type GameMode } from '../state/useBlocks';
import { useProfile } from '../state/useProfile';
import { addScore } from '../storage';
import type { PlayerView, Snapshot } from '../types';

const N = GAME.GRID_SIZE;
const FRAME = 4; // border + centering offset between the board frame and the grid

interface Drag {
  index: number;
  x: number;
  y: number;
}
interface Origin {
  x: number;
  y: number;
}
type ViewHandle = React.ComponentRef<typeof View>;

const measure = (view: ViewHandle | null) =>
  new Promise<Origin>((resolve) => {
    if (!view) return resolve({ x: 0, y: 0 });
    view.measureInWindow((x, y) => resolve({ x, y }));
  });

function PowerButton({
  icon,
  label,
  count,
  active,
  disabled,
  onPress,
}: {
  icon: string;
  label: string;
  count: number;
  active?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.power, active && styles.powerOn, disabled && !active && styles.powerOff]}
    >
      <Text style={styles.powerText}>
        {icon} {label}
      </Text>
      <Text style={styles.powerCount}>{count}</Text>
    </Pressable>
  );
}

export interface BattleProps {
  me: PlayerView;
  opp: PlayerView | null;
  timeLeft: number;
  onLocalUpdate: (s: Snapshot) => void;
}

interface Props {
  mode: GameMode;
  onExit: () => void;
  battle?: BattleProps;
}

export function GameScreen({ mode, onExit, battle }: Props) {
  const { width, height } = useWindowDimensions();
  const { state, fx, boost, place, restart, revive, shield, bomb, activateBoost, setAdsRemoved } = useBlocks(mode);
  const { profile, consume, reportRun, setLiveScore } = useProfile();
  const theme = themeFor(profile?.equipped);
  const have = (id: string) => profile?.inventory[id] ?? 0;

  // Space taken by HUD, tray, power-ups and footer; the battle scoreboard needs extra room.
  const reserve = battle ? 440 : 360;
  const boardSize = Math.max(200, Math.min(width - 32, 400, height - reserve));
  const cell = boardSize / N;
  const slotW = boardSize / GAME.PIECES_PER_DEAL;
  const trayCell = Math.min(cell * 0.66, slotW / 5.2);
  const lift = Math.max(56, cell * 1.6); // keeps the dragged piece visible above the finger

  const boardRef = useRef<ViewHandle>(null);
  const rootRef = useRef<ViewHandle>(null);
  const originsReady = useRef(Promise.resolve());
  const origins = useRef<{ board: Origin; root: Origin }>({
    board: { x: 0, y: 0 },
    root: { x: 0, y: 0 },
  });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);

  useEffect(() => {
    void initAds();
    void initIap({ onRemoveAdsOwned: setAdsRemoved, onError: (m) => console.warn(m) });
    return () => {
      void disposeIap();
    };
  }, [setAdsRemoved]);

  // Solo: record finished runs on the local leaderboard (one entry per game, keeps the best of revives).
  const gameId = useRef(Date.now());
  const status = state?.status;
  const finalScore = state?.score ?? 0;
  useEffect(() => {
    if (mode === 'solo' && status === 'over') {
      void addScore(gameId.current, finalScore);
      void reportRun(String(gameId.current), finalScore);
    }
  }, [mode, status, finalScore, reportRun]);
  const restartGame = () => {
    gameId.current = Date.now();
    setSelectedPiece(null);
    restart();
  };
  const exit = () => {
    if (mode === 'solo' && finalScore > 0) void reportRun(String(gameId.current), finalScore);
    onExit();
  };

  // Amigos veem a pontuação da partida em andamento.
  useEffect(() => {
    setLiveScore(state?.score ?? 0);
    return () => setLiveScore(0);
  }, [state?.score, setLiveScore]);

  const applyItem = async (id: 'boost_x2' | 'bomb') => {
    if (await consume(id)) return;
    if (id === 'boost_x2') activateBoost();
    else bomb();
  };
  const applyShield = async () => {
    if (!(await consume('shield'))) shield();
  };

  // Battle: broadcast every change to the opponent.
  const onLocalUpdate = useRef(battle?.onLocalUpdate);
  onLocalUpdate.current = battle?.onLocalUpdate;
  useEffect(() => {
    if (!state || !onLocalUpdate.current) return;
    onLocalUpdate.current({ score: state.score, combo: state.combo, grid: state.grid, over: state.status === 'over' });
  }, [state]);

  /** Drop position -> snapped board anchor (null if nothing legal nearby). */
  const targetFor = (index: number, x: number, y: number) => {
    const piece = state?.pieces[index];
    if (!state || !piece) return null;
    const { rows, cols } = pieceDims(piece);
    const left = x - (cols * cell) / 2 - origins.current.board.x - FRAME;
    const top = y - (rows * cell) / 2 - lift - origins.current.board.y - FRAME;
    return snapPlacement(state.grid, piece, Math.round(top / cell), Math.round(left / cell));
  };

  // PanResponders are created once; they read the latest handlers through this ref.
  const handlers = useRef({
    grant: (_i: number, _x: number, _y: number) => {},
    move: (_i: number, _x: number, _y: number) => {},
    release: (_i: number, _x: number, _y: number, _startX: number, _startY: number) => {},
  });
  handlers.current = {
    grant: (index, x, y) => {
      setDrag({ index, x, y });
      setSelectedPiece(null);
      originsReady.current = Promise.all([measure(boardRef.current), measure(rootRef.current)]).then(
        ([board, root]) => {
          origins.current = { board, root };
          setDrag((d) => (d ? { ...d } : d));
        },
      );
    },
    move: (index, x, y) => setDrag((d) => (d ? { index, x, y } : d)),
    release: async (index, x, y, startX, startY) => {
      await originsReady.current;
      const moved = Math.hypot(x - startX, y - startY) >= 12;
      const t = moved ? targetFor(index, x, y) : null;
      if (t) {
        place(index, t.r, t.c);
        setSelectedPiece(null);
      } else {
        setSelectedPiece(index);
      }
      setDrag(null);
    },
  };

  const responders = useMemo(
    () =>
      Array.from({ length: GAME.PIECES_PER_DEAL }, (_, i) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: (_e, g) => handlers.current.grant(i, g.x0, g.y0),
          onPanResponderMove: (_e, g) => handlers.current.move(i, g.moveX, g.moveY),
          onPanResponderRelease: (_e, g) =>
            handlers.current.release(i, g.moveX, g.moveY, g.x0, g.y0),
          onPanResponderTerminate: () => setDrag(null),
        }),
      ),
    [],
  );

  if (!state) return <View style={styles.root} />;

  const dragged = drag ? state.pieces[drag.index] : null;
  const target = drag ? targetFor(drag.index, drag.x, drag.y) : null;
  const placeSelectedAt = (x: number, y: number) => {
    if (selectedPiece === null || state.status !== 'playing') return;
    const piece = state.pieces[selectedPiece];
    if (!piece) return;
    const { rows, cols } = pieceDims(piece);
    const placement = snapPlacement(
      state.grid,
      piece,
      Math.round(y / cell - rows / 2),
      Math.round(x / cell - cols / 2),
    );
    if (!placement) return;
    place(selectedPiece, placement.r, placement.c);
    setSelectedPiece(null);
  };
  const ghost = new Set<string>();
  // Rows/columns that would be completed by the current drop
  const previewLines = { rows: new Set<number>(), cols: new Set<number>() };
  if (dragged && target) {
    const sim = state.grid.map((row) => [...row]);
    dragged.cells.forEach(([dr, dc]) => {
      ghost.add(`${target.r + dr},${target.c + dc}`);
      sim[target.r + dr][target.c + dc] = dragged.color;
    });
    for (let i = 0; i < N; i++) {
      if (sim[i].every((v) => v !== null)) previewLines.rows.add(i);
      if (sim.every((row) => row[i] !== null)) previewLines.cols.add(i);
    }
  }

  return (
    <View ref={rootRef} style={styles.root} collapsable={false}>
      <ThemedBackdrop themeId={theme.id} />

      <ScoreHud score={state.score} best={state.best} combo={state.combo} coins={profile?.coins} onBack={exit} />
      {battle && <LiveScoreboard me={battle.me} opp={battle.opp} timeLeft={battle.timeLeft} />}

      <View
        ref={boardRef}
        collapsable={false}
        style={[
          styles.board,
          {
            width: boardSize + 8,
            height: boardSize + 8 + 7,
            backgroundColor: theme.board,
            borderTopColor: theme.frameTop,
            borderLeftColor: theme.frameSide,
            shadowColor: theme.glow,
          },
          state.combo >= 2 && styles.boardHot,
        ]}
      >
        <View
          style={{ width: boardSize, height: boardSize }}
          onStartShouldSetResponder={() => selectedPiece !== null}
          onResponderRelease={(event) =>
            placeSelectedAt(event.nativeEvent.locationX, event.nativeEvent.locationY)
          }
        >
          {state.grid.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((v, c) => {
                const isGhost = ghost.has(`${r},${c}`);
                const lineHit = previewLines.rows.has(r) || previewLines.cols.has(c);
                return (
                  <View
                    key={c}
                    style={[
                      styles.cell,
                      { backgroundColor: (r + c) % 2 === 0 ? theme.cellAlt : theme.cell },
                      lineHit && styles.cellLine,
                      { width: cell, height: cell },
                    ]}
                  >
                    {v !== null ? (
                      <Block color={v} size={cell} />
                    ) : isGhost && dragged ? (
                      <Block color={dragged.color} size={cell} ghost />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          <ClearEffects fx={fx} cell={cell} boardSize={boardSize} />
        </View>
      </View>

      <Text style={styles.hint}>
        {selectedPiece === null
          ? 'Arraste uma peça ou toque nela e depois no tabuleiro'
          : 'Peça selecionada: toque em uma casa livre'}
      </Text>
      <View style={[styles.tray, { width: boardSize + 8 }]}>
        {state.pieces.map((piece, i) => (
          <View
            key={i}
            style={[
              styles.slot,
              { width: slotW, height: trayCell * 5 + 12 },
              selectedPiece === i && styles.slotSelected,
            ]}
            {...(piece ? responders[i].panHandlers : {})}
          >
            {piece && (
              <View style={{ opacity: drag?.index === i ? 0.2 : 1 }}>
                <PieceView piece={piece} size={trayCell} />
              </View>
            )}
          </View>
        ))}
      </View>

      {drag && dragged && (
        <View
          pointerEvents="none"
          style={[
            styles.dragLayer,
            {
              left: drag.x - (pieceDims(dragged).cols * cell) / 2 - origins.current.root.x,
              top: drag.y - (pieceDims(dragged).rows * cell) / 2 - lift - origins.current.root.y,
            },
          ]}
        >
          <PieceView piece={dragged} size={cell} />
        </View>
      )}

      {mode === 'solo' && (
        <View style={styles.powerBar}>
          <PowerButton
            icon="⚡"
            label={boost > 0 ? `x2 · ${boost}` : 'x2'}
            count={have('boost_x2')}
            active={boost > 0}
            disabled={boost > 0 || have('boost_x2') === 0 || state.status !== 'playing'}
            onPress={() => applyItem('boost_x2')}
          />
          <PowerButton
            icon="💣"
            label="Bomba"
            count={have('bomb')}
            disabled={have('bomb') === 0 || state.status !== 'playing'}
            onPress={() => applyItem('bomb')}
          />
        </View>
      )}

      {mode === 'solo' && !state.adsRemoved && (
        <View style={styles.footer}>
          <Pressable onPress={() => buyRemoveAds((m) => Alert.alert('Loja', m))}>
            <Text style={styles.link}>Remover anúncios</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              restorePurchases({
                onRemoveAdsOwned: setAdsRemoved,
                onError: (m) => Alert.alert('Loja', m),
              })
            }
          >
            <Text style={styles.link}>Restaurar compras</Text>
          </Pressable>
        </View>
      )}

      {mode === 'solo' && (
        <GameOverModal
          visible={state.status === 'over'}
          score={state.score}
          best={state.best}
          canRevive={!state.revived}
          adsRemoved={state.adsRemoved}
          onRevive={revive}
          onRestart={restartGame}
          shields={have('shield')}
          onShield={applyShield}
        />
      )}
      {battle && state.status === 'over' && (
        <View pointerEvents="none" style={styles.waitBanner}>
          <Text style={styles.waitText}>❌ Sem jogadas! Aguardando o adversário…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', overflow: 'hidden' },
  waitBanner: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 70,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.6)',
  },
  waitText: { color: '#fecaca', fontWeight: '800', fontSize: 13 },
  board: {
    backgroundColor: '#142036',
    borderRadius: 20,
    borderWidth: 2,
    borderTopColor: 'rgba(148,197,255,0.45)',
    borderLeftColor: 'rgba(148,197,255,0.3)',
    borderRightColor: 'rgba(0,0,0,0.4)',
    borderBottomColor: '#070d1a',
    borderBottomWidth: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  boardHot: { borderTopColor: '#fdba74', borderLeftColor: '#fb923c', shadowColor: '#f97316' },
  row: { flexDirection: 'row' },
  cell: {
    backgroundColor: COLORS.cell,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  cellAlt: { backgroundColor: '#1b2940' },
  cellLine: { backgroundColor: 'rgba(250,204,21,0.3)' },
  hint: { color: COLORS.muted, fontSize: 11, marginTop: 8, textAlign: 'center' },
  powerBar: { flexDirection: 'row', gap: 12, marginTop: 12 },
  power: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  powerOn: { borderColor: '#facc15', backgroundColor: 'rgba(250,204,21,0.18)' },
  powerOff: { opacity: 0.4 },
  powerText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  powerCount: { color: '#facc15', fontWeight: '900', fontSize: 13 },
  tray: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderBottomWidth: 6,
    borderBottomColor: '#070d1a',
    paddingVertical: 6,
  },
  slot: { alignItems: 'center', justifyContent: 'center' },
  slotSelected: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  dragLayer: {
    position: 'absolute',
    transform: [{ scale: 1.06 }],
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 22 },
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    marginTop: 'auto',
    paddingVertical: 12,
  },
  link: { color: COLORS.muted, fontSize: 12, textDecorationLine: 'underline' },
});
