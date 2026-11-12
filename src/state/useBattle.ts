import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoom, joinRoom, type Attack, type BattleMsg, type Connection, type Handlers } from '../services/battle';
import type { BattleResult, PlayerView, Snapshot } from '../types';

export const BATTLE_SECONDS = 120;
const COUNTDOWN = 3;

/** Ataque recebido do adversário, na fila para ser aplicado no tabuleiro. */
export type IncomingAttack = Attack & { id: string; from: string };

/** Intervalo mínimo entre ataques enviados (evita spam). */
export const ATTACK_COOLDOWN_MS = 2500;

export type Phase = 'idle' | 'connecting' | 'lobby' | 'countdown' | 'playing' | 'finished';
type Role = 'host' | 'guest';

const blank = (name: string): PlayerView => ({ name, score: 0, combo: 0, grid: null, over: false });

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.');

/** Room + match state machine for a 1v1 battle. Rules: 2 minutes, highest score wins. */
export function useBattle() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [role, setRole] = useState<Role | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<PlayerView>(blank('Você'));
  const [opp, setOpp] = useState<PlayerView | null>(null);
  const [timeLeft, setTimeLeft] = useState(BATTLE_SECONDS);
  const [count, setCount] = useState(COUNTDOWN);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<BattleResult | null>(null);
  /** Id único da partida atual (usado para creditar moedas uma única vez). */
  const [matchId, setMatchId] = useState('');
  const [incoming, setIncoming] = useState<IncomingAttack[]>([]);
  const lastAttack = useRef(0);

  const conn = useRef<Connection | null>(null);
  const roleRef = useRef<Role | null>(null);
  const nameRef = useRef('Você');
  const phaseRef = useRef(phase);
  const meRef = useRef(me);
  const oppRef = useRef(opp);
  phaseRef.current = phase;
  meRef.current = me;
  oppRef.current = opp;

  const finish = useCallback((reason: BattleResult['reason']) => {
    if (phaseRef.current === 'finished') return;
    phaseRef.current = 'finished';
    const myScore = meRef.current.score;
    const oppScore = oppRef.current?.score ?? 0;
    const outcome = reason === 'left' ? 'win' : myScore > oppScore ? 'win' : myScore < oppScore ? 'lose' : 'draw';
    setResult({ outcome, reason, myScore, oppScore });
    setPhase('finished');
  }, []);

  const teardown = useCallback(() => {
    conn.current?.close();
    conn.current = null;
    roleRef.current = null;
    phaseRef.current = 'idle';
    setRole(null);
    setCode('');
    setOpp(null);
    setResult(null);
    setPhase('idle');
  }, []);

  const beginRound = useCallback(() => {
    setMe((m) => blank(m.name));
    setOpp((o) => (o ? blank(o.name) : o));
    setResult(null);
    setIncoming([]);
    setTimeLeft(BATTLE_SECONDS);
    setCount(COUNTDOWN);
    setRound((r) => r + 1);
    setMatchId(`battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
    phaseRef.current = 'countdown';
    setPhase('countdown');
  }, []);

  const onMessage = useCallback(
    (msg: BattleMsg) => {
      if (msg.t === 'hello') {
        setOpp((o) => (o ? { ...o, name: msg.name } : blank(msg.name)));
      } else if (msg.t === 'start') {
        if (roleRef.current === 'guest') beginRound();
      } else if (msg.t === 'attack') {
        if (phaseRef.current !== 'playing') return;
        const { t: _t, ...attack } = msg;
        setIncoming((q) => (q.some((a) => a.id === msg.id) ? q : [...q.slice(-9), { ...attack, from: oppRef.current?.name ?? 'Amigo' }]));
      } else if (msg.t === 'state') {
        if (phaseRef.current === 'finished') return;
        setOpp((o) => ({ ...(o ?? blank('Amigo')), score: msg.score, combo: msg.combo, over: msg.over, grid: msg.grid }));
      }
    },
    [beginRound],
  );

  const onPeerJoined = useCallback(() => {
    setOpp((o) => o ?? blank('Amigo'));
    conn.current?.send({ t: 'hello', name: nameRef.current });
  }, []);

  const onPeerLeft = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'countdown' || p === 'playing') {
      finish('left');
    } else if (p === 'finished' || roleRef.current === 'host') {
      setOpp(null);
    } else {
      teardown();
      setError('A sala foi encerrada pelo anfitrião.');
    }
  }, [finish, teardown]);

  const onFatal = useCallback(
    (message: string) => {
      teardown();
      setError(message);
    },
    [teardown],
  );

  // Stable handler object whose methods always call the latest callbacks.
  const latest = useRef<Handlers>({ onMessage, onPeerJoined, onPeerLeft, onFatal });
  latest.current = { onMessage, onPeerJoined, onPeerLeft, onFatal };
  const handlers = useRef<Handlers>({
    onMessage: (m) => latest.current.onMessage(m),
    onPeerJoined: () => latest.current.onPeerJoined(),
    onPeerLeft: () => latest.current.onPeerLeft(),
    onFatal: (m) => latest.current.onFatal(m),
  }).current;

  const host = useCallback(
    async (name: string) => {
      setError(null);
      nameRef.current = name;
      setMe(blank(name));
      roleRef.current = 'host';
      setRole('host');
      phaseRef.current = 'connecting';
      setPhase('connecting');
      try {
        const room = await createRoom(handlers);
        conn.current = room.conn;
        setCode(room.code);
        phaseRef.current = 'lobby';
        setPhase('lobby');
      } catch (e) {
        roleRef.current = null;
        setRole(null);
        setError(errorText(e));
        phaseRef.current = 'idle';
        setPhase('idle');
      }
    },
    [handlers],
  );

  const join = useCallback(
    async (roomCode: string, name: string) => {
      setError(null);
      nameRef.current = name;
      setMe(blank(name));
      roleRef.current = 'guest';
      setRole('guest');
      phaseRef.current = 'connecting';
      setPhase('connecting');
      try {
        const c = await joinRoom(roomCode, handlers);
        conn.current = c;
        c.send({ t: 'hello', name });
        setCode(roomCode.toUpperCase());
        phaseRef.current = 'lobby';
        setPhase('lobby');
      } catch (e) {
        roleRef.current = null;
        setRole(null);
        setError(errorText(e));
        phaseRef.current = 'idle';
        setPhase('idle');
      }
    },
    [handlers],
  );

  /** Host starts (or restarts) the match. */
  const start = useCallback(() => {
    if (roleRef.current !== 'host' || !oppRef.current) return;
    conn.current?.send({ t: 'start' });
    beginRound();
  }, [beginRound]);

  const sendState = useCallback((s: Snapshot) => {
    // Depois do apito final o placar fica congelado.
    if (phaseRef.current === 'finished') return;
    setMe((m) => ({ ...m, ...s }));
    conn.current?.send({ t: 'state', ...s });
  }, []);

  /** Envia um ataque. Retorna false se estiver em recarga ou fora da partida. */
  const sendAttack = useCallback((a: Attack, auto = false): boolean => {
    if (phaseRef.current !== 'playing' || !conn.current) return false;
    const now = Date.now();
    // Ataques comprados têm recarga; o lixo automático dos combos não.
    if (!auto) {
      if (now - lastAttack.current < ATTACK_COOLDOWN_MS) return false;
      lastAttack.current = now;
    }
    conn.current.send({ t: 'attack', id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...a } as BattleMsg);
    return true;
  }, []);

  /** Remove da fila os ataques já aplicados. */
  const ackAttacks = useCallback((ids: string[]) => {
    setIncoming((q) => q.filter((a) => !ids.includes(a.id)));
  }, []);

  const leave = useCallback(() => {
    teardown();
    setError(null);
  }, [teardown]);

  useEffect(
    () => () => {
      conn.current?.close();
      conn.current = null;
    },
    [],
  );

  // 3-2-1-GO, then the match clock.
  useEffect(() => {
    if (phase !== 'countdown') return;
    let n = COUNTDOWN;
    let go: ReturnType<typeof setTimeout> | undefined;
    setCount(n);
    const id = setInterval(() => {
      n -= 1;
      setCount(n);
      if (n <= 0) {
        clearInterval(id);
        go = setTimeout(() => {
          phaseRef.current = 'playing';
          setPhase('playing');
        }, 600);
      }
    }, 1000);
    return () => {
      clearInterval(id);
      if (go) clearTimeout(go);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const end = Date.now() + BATTLE_SECONDS * 1000;
    setTimeLeft(BATTLE_SECONDS);
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) finish('time');
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish]);

  // A player without moves can't score anymore, so end early once the outcome is decided.
  useEffect(() => {
    if (phase !== 'playing' || !opp) return;
    const decided =
      (me.over && opp.over) || (me.over && opp.score > me.score) || (opp.over && me.score > opp.score);
    if (decided) finish('out');
  }, [phase, me.over, me.score, opp, finish]);

  return { phase, role, code, error, me, opp, timeLeft, count, round, matchId, result, incoming, host, join, start, sendState, sendAttack, ackAttacks, leave };
}
