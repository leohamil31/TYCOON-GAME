import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { ClearEffects, FloatScore } from '../components/ClearEffects';
import { GameOverModal, type RescueOption } from '../components/GameOverModal';
import { BattleHud } from '../components/BattleHud';
import { Block, PopIn, PieceView, TrayPiece } from '../components/Piece';
import { PowerBar, type PowerChip } from '../components/PowerBar';
import { ScoreHud } from '../components/ScoreHud';
import { ShopModal } from '../components/ShopModal';
import { ThemedBackdrop } from '../components/ThemedBackdrop';
import { Toast, type ToastMsg } from '../components/Toast';
import { BLOCK_COLORS, GAME } from '../constants';
import { fillOf, garbageFor, pieceDims, pieceFits, snapPlacement } from '../game/engine';
import { initAds } from '../services/ads';
import { haptic, play } from '../services/sfx';
import { buyRemoveAds, disposeIap, initIap, restorePurchases } from '../services/iap';
import { ATTACK_IDS, BOOST_MOVES, coinsForScore, DEFAULT_FX, DEFAULT_SKIN, itemById, type AttackId, type PowerupId } from '../shop/catalog';
import { themeFor } from '../shop/themes';
import { useBlocks, type GameMode } from '../state/useBlocks';
import { useProfile } from '../state/useProfile';
import { useProgress } from '../state/useProgress';
import { addScore } from '../storage';
import { alpha, gradient, NEON, PALETTE, USE_NATIVE_DRIVER } from '../theme';
import type { PlayerView, Snapshot } from '../types';
import type { Attack } from '../services/battle';
import { ATTACK_COOLDOWN_MS, type IncomingAttack } from '../state/useBattle';
import { AimBoard, type AimMode } from '../components/AimBoard';
import { SkinContext } from '../components/Piece';

const N = GAME.GRID_SIZE;
const PAD = 4; // borda + respiro entre a moldura e a grade

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
    view.measureInWindow((x: number, y: number) => resolve({ x, y }));
  });

export interface BattleProps {
  me: PlayerView;
  opp: PlayerView | null;
  timeLeft: number;
  /** Contagem regressiva ou partida encerrada: o tabuleiro não aceita jogadas. */
  locked: boolean;
  onLocalUpdate: (s: Snapshot) => void;
  /** Ataques recebidos do adversário, ainda não aplicados. */
  incoming: IncomingAttack[];
  /** Envia um ataque (auto = gerado por combo, ignora a recarga). */
  sendAttack: (a: Attack, auto?: boolean) => boolean;
  ackAttacks: (ids: string[]) => void;
}

interface Props {
  mode: GameMode;
  onExit: () => void;
  battle?: BattleProps;
}

const TONES: Record<PowerupId | AttackId, string> = {
  garbage: '#94a3b8',
  freeze: '#7dd3fc',
  rubble: '#a78bfa',
  boost_x2: NEON.gold,
  bomb: '#fb923c',
  reroll: NEON.cyan,
  undo: NEON.violet,
  shield: NEON.green,
};
const SHORT: Record<PowerupId | AttackId, string> = {
  boost_x2: 'x2',
  bomb: 'Bomba',
  reroll: 'Trocar',
  undo: 'Voltar',
  shield: 'Escudo',
  garbage: 'Lixo',
  freeze: 'Gelo',
  rubble: 'Entulho',
};
const FREEZE_MS = 4000;

/** Laço 0→1→0 enquanto `on` for verdadeiro (pulsos de alerta/brilho). */
function usePulse(on: boolean, duration: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, duration, v]);
  return v;
}

export function GameScreen({ mode, onExit, battle }: Props) {
  const win = useWindowDimensions();
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const W = area?.w ?? win.width;
  const H = area?.h ?? win.height;
  const matchLocked = !!battle?.locked;
  // Congelado pelo rival: a bandeja (e os itens) ficam travados por alguns segundos.
  const [frozen, setFrozen] = useState(false);
  const locked = matchLocked || frozen;

  const {
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
    bombAt,
    receiveAttack,
    reroll,
    undoMove,
    activateBoost,
    setAdsRemoved,
  } = useBlocks(mode, locked);
  const { profile, consume, reportRun, setLiveScore } = useProfile();
  // Missões do dia: linhas, combos, bombas e ataques contam aqui; partidas/pontos/batalhas contam no servidor.
  const { track: trackMission, flush: flushMissions } = useProgress();
  const track = useCallback((k: 'lines' | 'combos' | 'bombs' | 'attacks', n = 1) => trackMission({ [k]: n }), [trackMission]);
  useEffect(() => () => void flushMissions(), [flushMissions]);
  const theme = themeFor(profile?.equipped);
  const have = (id: string) => profile?.inventory[id] ?? 0;

  const [shopOpen, setShopOpen] = useState(false);
  const [aim, setAim] = useState<AimMode | null>(null);
  const lastSent = useRef(0);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastId = useRef(0);
  const say = useCallback((text: string, kind: ToastMsg['kind'] = 'info', icon?: string) => {
    setToast({ id: ++toastId.current, text, kind, icon });
  }, []);

  // ------------------------------------------------------------- layout responsivo
  const showFooter = mode === 'solo' && !!state && !state.adsRemoved;
  const landscape = W >= 760 && W > H * 1.2;
  // Batalha usa uma faixa compacta (BattleHud) no lugar do HUD + placar: sobra espaço para a arena.
  const hudH = battle ? 76 : 84; // ScoreHud: 64 + margens
  const boardBox = PAD * 2 + 10; // moldura + borda inferior 3D
  let boardSize: number;
  let sideW: number;
  const footerH = showFooter ? 36 : 0;
  if (landscape) {
    boardSize = Math.min(H - hudH - footerH - boardBox - 28, W * 0.5, 620);
    sideW = Math.min(440, W - boardSize - boardBox - 72);
  } else {
    const powerH = battle ? 72 : 92; // uma fileira de botões + espaçamento
    const hintH = battle ? 22 : 32;
    const avail = H - hudH - powerH - footerH - hintH - boardBox - 12;
    // A bandeja ocupa ~32% do lado do tabuleiro (peças com 5 casas a ~64% do tamanho da casa).
    boardSize = Math.min(W - 14 - boardBox, 560, (avail - 20) / 1.32);
    sideW = boardSize + boardBox;
  }
  boardSize = Math.floor(Math.max(200, boardSize));
  const cell = boardSize / N;
  const slotW = (landscape ? sideW : boardSize + boardBox) / GAME.PIECES_PER_DEAL;
  const trayCell = Math.min(cell * (landscape ? 0.72 : 0.64), (slotW - 8) / 5.2);
  const trayH = trayCell * 5 + 16;
  const lift = Math.max(56, cell * 1.6); // mantém a peça arrastada visível acima do dedo

  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((a) => (a && a.w === width && a.h === height ? a : { w: width, h: height }));
  };

  // ------------------------------------------------------------- serviços
  useEffect(() => {
    void initAds();
    void initIap({ onRemoveAdsOwned: setAdsRemoved, onError: (m) => console.warn(m) });
    return () => {
      void disposeIap();
    };
  }, [setAdsRemoved]);

  // Solo: registra a partida no ranking local e credita moedas (uma vez por pontuação).
  const gameId = useRef(Date.now());
  const reported = useRef('');
  const status = state?.status;
  const finalScore = state?.score ?? 0;
  useEffect(() => {
    if (mode !== 'solo' || status !== 'over') return;
    const key = `${gameId.current}:${finalScore}`;
    if (reported.current === key) return;
    reported.current = key;
    void addScore(gameId.current, finalScore);
    void reportRun(String(gameId.current), finalScore);
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
  }, [state?.score, setLiveScore]);
  useEffect(() => () => setLiveScore(0), [setLiveScore]);

  // Batalha: envia cada mudança ao adversário.
  const onLocalUpdate = useRef(battle?.onLocalUpdate);
  onLocalUpdate.current = battle?.onLocalUpdate;
  useEffect(() => {
    if (!state || !onLocalUpdate.current) return;
    onLocalUpdate.current({ score: state.score, combo: state.combo, grid: state.grid, over: state.status === 'over' });
  }, [state]);

  // ------------------------------------------------------------- power-ups (solo e online)
  const busy = useRef(false);
  const applyItem = async (id: string) => {
    const s = state;
    const item = itemById(id);
    if (!s || !item || busy.current) return;
    if (matchLocked) return say('Espere a partida começar!', 'info', '⏳');
    if (frozen) return say('Você está congelado!', 'info', '❄️');
    if (item.battle && !battle) return say('Ataques só funcionam na batalha online.', 'info', item.icon);
    if (have(id) <= 0) {
      setShopOpen(true);
      return;
    }
    // Valida antes de gastar o item.
    const why =
      id === 'boost_x2' && boost > 0
        ? 'O x2 já está ativo.'
        : id === 'bomb' && s.grid.every((row) => row.every((v) => v === null))
          ? 'Seu tabuleiro está vazio.'
          : (id === 'garbage' || id === 'freeze' || id === 'rubble') && Date.now() - lastSent.current < ATTACK_COOLDOWN_MS
            ? 'Recarregando o ataque…'
            : id === 'rubble' && !battle?.opp?.grid
              ? 'Ainda não vimos o tabuleiro do rival.'
              : id === 'undo' && !canUndo
            ? 'Nada para desfazer agora.'
            : id === 'shield' && s.status !== 'over'
              ? 'O escudo é usado quando você fica sem jogadas.'
              : null;
    if (why) return say(why, 'info', item.icon);
    // Bombas abrem a mira primeiro; o item só é gasto ao confirmar.
    if (id === 'bomb' || id === 'rubble') {
      setSelectedPiece(null);
      setAim(id === 'bomb' ? 'blast' : 'rubble');
      return;
    }

    busy.current = true;
    const err = await consume(id);
    busy.current = false;
    if (err) return say(err, 'error', '⚠️');
    setSelectedPiece(null);
    if (id === 'boost_x2') {
      activateBoost();
      say(`Pontos em dobro nas próximas ${BOOST_MOVES} jogadas!`, 'ok', '⚡');
    } else if (id === 'garbage' || id === 'freeze') {
      lastSent.current = Date.now();
      battle?.sendAttack(id === 'garbage' ? { kind: 'garbage', n: 4 } : { kind: 'freeze' });
      play('attackSend');
      track('attacks');
      say(id === 'garbage' ? '4 blocos de lixo enviados!' : 'Bandeja do rival congelada!', 'ok', item.icon);
    } else if (id === 'reroll') {
      reroll();
      say('Peças novas na bandeja!', 'ok', '🔄');
    } else if (id === 'undo') {
      undoMove();
      say('Jogada desfeita.', 'ok', '↩️');
    } else if (id === 'shield') {
      shield();
      say('Escudo ativado! Espaço liberado.', 'ok', '🛡️');
    }
  };

  /** Confirmação da mira: gasta o item e explode / lança o entulho. */
  const fireAim = async (r: number, c: number) => {
    const mode = aim;
    setAim(null);
    if (!mode || busy.current) return;
    const id = mode === 'blast' ? 'bomb' : 'rubble';
    busy.current = true;
    const err = await consume(id);
    busy.current = false;
    if (err) return say(err, 'error', '⚠️');
    if (mode === 'blast') {
      bombAt(r, c);
      track('bombs');
    } else {
      lastSent.current = Date.now();
      battle?.sendAttack({ kind: 'rubble', r, c });
      play('attackSend');
      track('attacks');
      say('Bomba de entulho lançada!', 'ok', '☄️');
    }
  };

  const ids: PowerupId[] = ['boost_x2', 'bomb', 'reroll', 'undo'];
  const chips: PowerChip[] = ids.map((id) => ({
    id,
    icon: itemById(id)?.icon ?? '?',
    label: SHORT[id],
    count: have(id),
    tone: TONES[id],
    active: id === 'boost_x2' && boost > 0,
    activeText: id === 'boost_x2' && boost > 0 ? `${boost}` : undefined,
    disabled: locked || (id === 'undo' && !canUndo),
  }));
  const attackChips: PowerChip[] = ATTACK_IDS.map((id) => ({
    id,
    icon: itemById(id)?.icon ?? '?',
    label: SHORT[id],
    count: have(id),
    tone: TONES[id],
    disabled: locked,
  }));
  const rescues: RescueOption[] = (['shield', 'reroll', 'bomb', 'undo'] as PowerupId[])
    .filter((id) => id !== 'undo' || canUndo)
    .map((id) => ({ id, icon: itemById(id)?.icon ?? '?', label: SHORT[id], count: have(id) }));

  // ------------------------------------------------------------- arrastar e soltar
  const gridRef = useRef<ViewHandle>(null);
  const rootRef = useRef<ViewHandle>(null);
  const originsReady = useRef(Promise.resolve());
  const origins = useRef<{ board: Origin; root: Origin }>({ board: { x: 0, y: 0 }, root: { x: 0, y: 0 } });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);

  const remeasure = () => {
    originsReady.current = Promise.all([measure(gridRef.current), measure(rootRef.current)]).then(([board, root]) => {
      origins.current = { board, root };
    });
    return originsReady.current;
  };

  /** Posição do dedo -> âncora no tabuleiro (com "ímã" de 1 casa). */
  const targetFor = (index: number, x: number, y: number) => {
    const piece = state?.pieces[index];
    if (!state || !piece) return null;
    const { rows, cols } = pieceDims(piece);
    const left = x - (cols * cell) / 2 - origins.current.board.x;
    const top = y - (rows * cell) / 2 - lift - origins.current.board.y;
    return snapPlacement(state.grid, piece, Math.round(top / cell), Math.round(left / cell));
  };

  // Os PanResponders são criados uma vez; leem os handlers mais recentes por esta ref.
  const handlers = useRef({
    grant: (_i: number, _x: number, _y: number) => {},
    move: (_i: number, _x: number, _y: number) => {},
    release: (_i: number, _x: number, _y: number, _sx: number, _sy: number) => {},
  });
  handlers.current = {
    grant: (index, x, y) => {
      if (locked || state?.status !== 'playing') return;
      setDrag({ index, x, y });
      play('pick');
      void remeasure().then(() => setDrag((d) => (d ? { ...d } : d)));
    },
    move: (index, x, y) => setDrag((d) => (d ? { index, x, y } : d)),
    release: async (index, x, y, startX, startY) => {
      await originsReady.current;
      const moved = Math.hypot(x - startX, y - startY) >= 12;
      const t = moved ? targetFor(index, x, y) : null;
      if (t) {
        place(index, t.r, t.c);
        setSelectedPiece(null);
      } else if (!moved && !locked) {
        // Toque simples: seleciona (ou desmarca) a peça para colocar tocando no tabuleiro.
        setSelectedPiece((cur) => (cur === index ? null : index));
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
          onPanResponderGrant: (_e: unknown, g: { x0: number; y0: number }) => handlers.current.grant(i, g.x0, g.y0),
          onPanResponderMove: (_e: unknown, g: { moveX: number; moveY: number }) => handlers.current.move(i, g.moveX, g.moveY),
          onPanResponderRelease: (_e: unknown, g: { moveX: number; moveY: number; x0: number; y0: number }) =>
            handlers.current.release(i, g.moveX || g.x0, g.moveY || g.y0, g.x0, g.y0),
          onPanResponderTerminate: () => setDrag(null),
        }),
      ),
    [],
  );

  // Toque no tabuleiro com peça selecionada. Usa pageX/pageY (locationX é relativo ao filho tocado na web).
  const tapBoard = async (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    if (selectedPiece === null || !state || state.status !== 'playing' || locked) return;
    const piece = state.pieces[selectedPiece];
    if (!piece) return setSelectedPiece(null);
    await remeasure();
    const x = pageX - origins.current.board.x;
    const y = pageY - origins.current.board.y;
    const { rows, cols } = pieceDims(piece);
    const spot = snapPlacement(state.grid, piece, Math.round(y / cell - rows / 2), Math.round(x / cell - cols / 2));
    if (!spot) {
      play('invalid');
      return say('Não cabe aí. Tente outra casa.', 'info', '🚫');
    }
    place(selectedPiece, spot.r, spot.c);
    setSelectedPiece(null);
  };

  // ------------------------------------------------------------- efeitos de tela
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!fx) return;
    const power = fx.kind === 'bomb' ? 9 : fx.lines >= 2 ? 3 + fx.lines * 1.5 : 0;
    if (!power) return;
    shake.setValue(0);
    Animated.sequence(
      [1, -0.8, 0.6, -0.4, 0.2, 0].map((k) =>
        Animated.timing(shake, { toValue: k * power, duration: 30, useNativeDriver: USE_NATIVE_DRIVER }),
      ),
    ).start();
  }, [fx, shake]);

  // ------------------------------------------------------------- sons e vibração
  useEffect(() => {
    if (!placed || placed.points <= 0) return; // points 0 = lixo recebido (som próprio)
    play('place', placed.cells.length);
    haptic('light');
  }, [placed]);
  useEffect(() => {
    if (!fx) return;
    if (fx.kind === 'bomb') {
      play('bomb');
      haptic('heavy');
    } else if (fx.kind === 'clear') {
      track('lines', fx.lines);
      if (fx.combo >= 2) track('combos');
      play(fx.perfect ? 'perfect' : 'clear', Math.min(4, fx.lines) * 10 + Math.min(9, fx.combo));
      haptic(fx.lines >= 2 || fx.combo >= 2 ? 'heavy' : 'medium');
    }
  }, [fx]);
  const overNow = state?.status === 'over';
  useEffect(() => {
    if (overNow) {
      void flushMissions();
      play('gameOver');
      haptic([40, 60, 40]);
    }
  }, [overNow]);

  // ------------------------------------------------------------- batalha: ataques recebidos e enviados
  const hit = useRef(new Animated.Value(0)).current;
  const flashHit = useCallback(() => {
    hit.setValue(1);
    Animated.timing(hit, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [hit]);

  // Aplica um ataque por vez (cada um parte do tabuleiro já atualizado pelo anterior).
  const incoming = battle?.incoming;
  const ack = battle?.ackAttacks;
  useEffect(() => {
    const a = incoming?.[0];
    if (!a || !ack || !state || matchLocked) return;
    ack([a.id]);
    flashHit();
    play(a.kind === 'freeze' ? 'freeze' : 'attackHit');
    haptic([30, 40, 50]);
    if (a.kind === 'freeze') {
      setFrozen(true);
      setSelectedPiece(null);
      setDrag(null);
      say(`${a.from} congelou sua bandeja!`, 'error', '❄️');
    } else {
      const n = receiveAttack(a);
      say(
        a.kind === 'garbage' ? `${a.from} jogou ${n} blocos de lixo em você!` : `${a.from} lançou uma bomba de entulho!`,
        'error',
        a.kind === 'garbage' ? '🧱' : '☄️',
      );
    }
  }, [incoming, ack, state, matchLocked, receiveAttack, flashHit, say]);

  useEffect(() => {
    if (!frozen) return;
    const t = setTimeout(() => setFrozen(false), FREEZE_MS);
    return () => clearTimeout(t);
  }, [frozen]);

  // Jogadas fortes viram lixo automático no rival (estilo Tetris Attack).
  const sendAttack = battle?.sendAttack;
  const lastAutoFx = useRef(0);
  useEffect(() => {
    if (!fx || fx.kind !== 'clear' || !sendAttack || matchLocked || lastAutoFx.current === fx.id) return;
    lastAutoFx.current = fx.id;
    const n = Math.min(8, garbageFor(fx.lines, fx.combo));
    if (n > 0 && sendAttack({ kind: 'garbage', n }, true)) {
      play('attackSend');
      track('attacks');
      say(`Combo! ${n} blocos de lixo no rival`, 'ok', '⚔️');
    }
  }, [fx, sendAttack, matchLocked, say]);

  const fill = state ? fillOf(state.grid) : 0;
  const danger = !!state && state.status === 'playing' && fill >= 0.68;
  const dangerPulse = usePulse(danger, 700);
  const hintPulse = usePulse(!!drag, 380);
  const boostPulse = usePulse(boost > 0, 800);

  if (!state) return <View ref={rootRef} style={styles.root} onLayout={onRootLayout} />;

  const dragged = drag ? state.pieces[drag.index] : null;
  const target = drag ? targetFor(drag.index, drag.x, drag.y) : null;
  const ghost = new Set<string>();
  // Linhas/colunas que a jogada atual completaria
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
  const poppedCells = new Set(placed ? placed.cells.map(([r, c]) => `${r},${c}`) : []);
  const combo = state.combo;
  const frameTone = boost > 0 ? NEON.gold : combo >= 2 ? '#fb923c' : theme.frameTop;
  const anySelected = selectedPiece !== null && !!state.pieces[selectedPiece];

  // ------------------------------------------------------------- peças da UI
  const board = (
    <Animated.View style={{ transform: [{ translateX: shake }] }}>
      <View
        style={[
          styles.board,
          gradient(160, [alpha(theme.frameSide, 0.35), theme.board, theme.board], theme.board),
          {
            padding: PAD - 2,
            borderTopColor: frameTone,
            borderLeftColor: alpha(frameTone, 0.6),
            borderRightColor: alpha(frameTone, 0.35),
            shadowColor: combo >= 2 || boost > 0 ? frameTone : theme.glow,
            shadowOpacity: 0.45 + Math.min(0.45, combo * 0.1),
            shadowRadius: 18 + Math.min(20, combo * 4),
          },
        ]}
      >
        <View
          ref={gridRef}
          collapsable={false}
          style={{ width: boardSize, height: boardSize }}
          onStartShouldSetResponder={() => anySelected}
          onResponderRelease={tapBoard}
        >
          {state.grid.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((v, c) => {
                const k = `${r},${c}`;
                const isGhost = ghost.has(k);
                const lineHit = previewLines.rows.has(r) || previewLines.cols.has(c);
                return (
                  <View key={c} style={{ width: cell, height: cell }}>
                    <View
                      style={[
                        styles.slotCell,
                        {
                          borderRadius: cell * 0.2,
                          backgroundColor: (r + c) % 2 === 0 ? theme.cellAlt : theme.cell,
                        },
                      ]}
                    />
                    {v !== null ? (
                      poppedCells.has(k) && placed ? (
                        <PopIn key={`p${placed.id}`} size={cell}>
                          <Block color={v} size={cell} />
                        </PopIn>
                      ) : (
                        <Block color={v} size={cell} />
                      )
                    ) : isGhost && dragged ? (
                      <Block color={dragged.color} size={cell} ghost />
                    ) : null}
                    {lineHit && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.lineHit,
                          {
                            borderRadius: cell * 0.22,
                            borderColor: dragged ? BLOCK_COLORS[dragged.color] : NEON.gold,
                            opacity: hintPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                          },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
          <FloatScore placed={fx && placed && fx.id === placed.id ? null : placed} cell={cell} />
          <ClearEffects fx={fx} cell={cell} boardSize={boardSize} fxStyle={profile?.effect ?? DEFAULT_FX} />
        </View>

        {danger && (
          <Animated.View
            pointerEvents="none"
            style={[styles.danger, { opacity: dangerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.7] }) }]}
          />
        )}
        <Animated.View pointerEvents="none" style={[styles.hitFlash, { opacity: hit }]} />
        {boost > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.boostTag, { transform: [{ scale: boostPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }]}
          >
            <Text style={styles.boostText}>⚡ x2 · {boost}</Text>
          </Animated.View>
        )}
        {combo >= 2 && (
          <View pointerEvents="none" style={styles.comboTag}>
            <Text style={styles.comboText}>🔥 x{combo}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const tray = (
    <View style={[styles.tray, { width: landscape ? sideW : boardSize + boardBox, height: trayH }]}>
      {frozen && (
        <View pointerEvents="none" style={styles.ice}>
          <Text style={styles.iceText}>❄️ CONGELADO</Text>
        </View>
      )}
      {state.pieces.map((piece, i) => {
        const fits = piece ? pieceFits(state.grid, piece) : false;
        return (
          <View
            key={i}
            style={[styles.slot, { width: slotW, height: trayH - 8 }, selectedPiece === i && styles.slotSelected]}
            {...(piece ? responders[i].panHandlers : {})}
          >
            {piece && (
              <TrayPiece
                piece={piece}
                size={trayCell}
                index={i}
                selected={selectedPiece === i}
                hidden={drag?.index === i}
                dim={!fits}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  const hint = (
    <Text style={styles.hint} numberOfLines={1}>
      {matchLocked
        ? '⏳ Prepare-se…'
        : frozen
          ? '❄️ Congelado! Espere derreter…'
        : anySelected
          ? '👆 Toque numa casa livre para encaixar'
          : 'Arraste uma peça • ou toque nela e depois no tabuleiro'}
    </Text>
  );

  const barW = landscape ? sideW : Math.min(W - 16, boardSize + boardBox + 40);
  // Batalha: power-ups e ataques numa fileira só (item zerado abre a loja).
  const power = battle ? (
    <PowerBar
      chips={[...chips, ...attackChips]}
      onUse={applyItem}
      onShop={() => setShopOpen(true)}
      width={barW}
      compact
      showShop={false}
      minSize={40}
      gap={5}
      divideAfter={chips.length}
    />
  ) : (
    <PowerBar chips={chips} onUse={applyItem} onShop={() => setShopOpen(true)} width={barW} compact={H < 640} slots={5} />
  );

  const battleOver = battle && state.status === 'over' && !locked;

  return (
    <SkinContext.Provider value={profile?.skin ?? DEFAULT_SKIN}>
    <View ref={rootRef} style={styles.root} collapsable={false} onLayout={onRootLayout}>
      <ThemedBackdrop themeId={theme.id} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, gradient(180, ['rgba(2,6,23,0.35)', 'rgba(2,6,23,0)', 'rgba(2,6,23,0.55)'], 'rgba(2,6,23,0.15)')]} />

      {battle ? (
        <BattleHud
          me={battle.me}
          opp={battle.opp}
          timeLeft={battle.timeLeft}
          myScore={state.score}
          combo={combo}
          coins={profile?.coins}
          onBack={exit}
        />
      ) : (
        <View style={styles.hudWrap}>
          <ScoreHud score={state.score} best={state.best} combo={combo} coins={profile?.coins} onBack={exit} title="TYCOON GAME" />
        </View>
      )}

      {landscape ? (
        <View style={styles.landscape}>
          {board}
          <View style={[styles.side, { width: sideW }]}>
            {tray}
            {hint}
            <View style={{ height: 12 }} />
            {power}
          </View>
        </View>
      ) : (
        <View style={styles.portrait}>
          {board}
          {hint}
          {tray}
          <View style={{ height: battle ? 8 : 12 }} />
          {power}
        </View>
      )}

      {drag && dragged && (
        <View
          pointerEvents="none"
          style={[
            styles.dragLayer,
            {
              left: drag.x - (pieceDims(dragged).cols * cell) / 2 - origins.current.root.x,
              top: drag.y - (pieceDims(dragged).rows * cell) / 2 - lift - origins.current.root.y,
              opacity: target ? 1 : 0.85,
            },
          ]}
        >
          <PieceView piece={dragged} size={cell} />
        </View>
      )}

      {showFooter && (
        <View style={styles.footer}>
          <Pressable onPress={() => buyRemoveAds((m) => Alert.alert('Loja', m))}>
            <Text style={styles.link}>🚫 Remover anúncios</Text>
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

      {battleOver && (
        <View style={styles.waitBanner}>
          <Text style={styles.waitText}>❌ Sem jogadas!</Text>
          {rescues.some((r) => r.count > 0) ? (
            <View style={styles.waitRow}>
              {rescues
                .filter((r) => r.count > 0)
                .map((r) => (
                  <Pressable key={r.id} style={styles.waitBtn} onPress={() => applyItem(r.id)} accessibilityRole="button">
                    <Text style={styles.waitBtnText}>
                      {r.icon} {r.label} ({r.count})
                    </Text>
                  </Pressable>
                ))}
            </View>
          ) : (
            <Pressable onPress={() => setShopOpen(true)}>
              <Text style={styles.waitSub}>Aguardando o adversário… ou compre itens na 🛒 loja</Text>
            </Pressable>
          )}
        </View>
      )}

      <Toast msg={toast} />
      <AimBoard
        visible={aim !== null}
        mode={aim ?? 'blast'}
        grid={aim === 'rubble' ? (battle?.opp?.grid ?? null) : state.grid}
        title={aim === 'rubble' ? `☄️ Mire em ${battle?.opp?.name ?? 'rival'}` : '💣 Onde explodir?'}
        onCancel={() => setAim(null)}
        onConfirm={fireAim}
      />

      {mode === 'solo' && (
        <GameOverModal
          visible={state.status === 'over' && !shopOpen && !aim}
          score={state.score}
          prevBest={startBest}
          coins={coinsForScore(state.score)}
          canRevive={!state.revived}
          adsRemoved={state.adsRemoved}
          onRevive={revive}
          onRestart={restartGame}
          onMenu={exit}
          rescues={rescues}
          onRescue={applyItem}
        />
      )}
      <ShopModal visible={shopOpen} onClose={() => setShopOpen(false)} initialTab="powerups" />
    </View>
    </SkinContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.void, alignItems: 'center', overflow: 'hidden' },
  hudWrap: { alignSelf: 'stretch', paddingHorizontal: 10, alignItems: 'center' },
  landscape: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, paddingBottom: 8 },
  side: { alignItems: 'center', justifyContent: 'center' },
  portrait: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingBottom: 6 },
  board: {
    borderRadius: 22,
    borderWidth: 2,
    borderBottomColor: '#050912',
    borderBottomWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  row: { flexDirection: 'row' },
  slotCell: {
    position: 'absolute',
    left: 1.5,
    top: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(0,0,0,0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  lineHit: {
    position: 'absolute',
    left: 1,
    top: 1,
    right: 1,
    bottom: 1,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  danger: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 1,
    shadowRadius: 18,
  },
  boostTag: {
    position: 'absolute',
    top: -14,
    right: 12,
    backgroundColor: NEON.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#0b1022',
    shadowColor: NEON.gold,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  boostText: { color: '#0b1022', fontWeight: '900', fontSize: 12 },
  comboTag: {
    position: 'absolute',
    top: -14,
    left: 12,
    backgroundColor: '#f97316',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#0b1022',
  },
  comboText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  hint: { color: 'rgba(203,213,225,0.75)', fontSize: 11.5, marginVertical: 5, textAlign: 'center', paddingHorizontal: 12 },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,197,255,0.18)',
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderBottomWidth: 6,
    borderBottomColor: '#050912',
    paddingVertical: 4,
    marginTop: 4,
  },
  slot: { alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  slotSelected: {
    borderWidth: 2,
    borderColor: NEON.cyan,
    backgroundColor: 'rgba(34,211,238,0.12)',
    shadowColor: NEON.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  dragLayer: {
    position: 'absolute',
    transform: [{ scale: 1.06 }],
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 22 },
    zIndex: 40,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  link: { color: 'rgba(148,163,184,0.85)', fontSize: 12, textDecorationLine: 'underline' },
  attackRow: { alignItems: 'center', gap: 4 },
  attackLabel: { color: '#fda4af', fontSize: 9.5, fontWeight: '900', letterSpacing: 2 },
  ice: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    borderRadius: 18,
    backgroundColor: 'rgba(125,211,252,0.28)',
    borderWidth: 2,
    borderColor: 'rgba(186,230,253,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iceText: { color: '#f0f9ff', fontWeight: '900', fontSize: 16, letterSpacing: 2, textShadowColor: '#0ea5e9', textShadowRadius: 10 },
  hitFlash: { ...StyleSheet.absoluteFill, borderRadius: 20, borderWidth: 4, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.12)' },
  waitBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(248,113,113,0.7)',
    zIndex: 30,
  },
  waitText: { color: '#fecaca', fontWeight: '900', fontSize: 15 },
  waitSub: { color: '#cbd5e1', fontSize: 12, marginTop: 4, textAlign: 'center' },
  waitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  waitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: alpha(NEON.violet, 0.25),
    borderWidth: 1.5,
    borderColor: alpha(NEON.violet, 0.8),
  },
  waitBtnText: { color: '#ede9fe', fontWeight: '800', fontSize: 13 },
});
