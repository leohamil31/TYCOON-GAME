import { BLOCK_COLORS, GAME } from '../constants';
import { backend } from './api';
import { cleanName } from '../storage';
import { supabase } from './supabase';
import type { Grid } from '../types';

/**
 * Transporte das batalhas. Com o Supabase configurado (src/services/supabase.ts) usa o Realtime dele;
 * senão, o servidor WebSocket próprio (server/). Os dois funcionam no navegador, Android e iOS.
 *
 * Central WebSocket transport for friend battles. The same room protocol works in web browsers,
 * Android, and iOS, without requiring the players' devices to accept peer-to-peer connections.
 */
/** Ataques de sabotagem que um jogador manda para o outro. */
export type AttackKind = 'garbage' | 'freeze' | 'rubble';
export type Attack =
  /** Blocos de lixo espalhados (n = quantidade). */
  | { kind: 'garbage'; n: number }
  /** Congela a bandeja do adversário por alguns segundos. */
  | { kind: 'freeze' }
  /** Bomba de entulho mirada: enche de lixo a área 3x3 em volta de (r, c). */
  | { kind: 'rubble'; r: number; c: number };

export type BattleMsg =
  | { t: 'hello'; name: string }
  | ({ t: 'attack'; id: string } & Attack)
  | { t: 'start' }
  | { t: 'state'; score: number; combo: number; over: boolean; grid: Grid }
  | { t: 'bye' };

export interface Connection {
  send(msg: BattleMsg): void;
  close(): void;
}

export interface Handlers {
  onMessage(msg: BattleMsg): void;
  /** Host only: a friend connected to the room. */
  onPeerJoined(): void;
  onPeerLeft(): void;
  /** Signalling server / network failed after the room was established. */
  onFatal(message: string): void;
}

const CODE_LEN = 5;
const N = GAME.GRID_SIZE;
const ERR_SERVER =
  'Sem conexão com o servidor de partidas. Verifique a internet e tente novamente.';
const ERR_NOT_FOUND =
  'Sala não encontrada. Confira o código e confirme que o anfitrião ainda está aguardando.';

export const normalizeCode = (raw: string): string =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LEN);

const isCount = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= 10_000_000;

const validGrid = (grid: unknown): grid is Grid =>
  Array.isArray(grid) &&
  grid.length === N &&
  grid.every(
    row =>
      Array.isArray(row) &&
      row.length === N &&
      row.every(
        cell =>
          cell === null ||
          (Number.isInteger(cell) && cell >= 0 && cell < BLOCK_COLORS.length),
      ),
  );

/** Everything coming from the server or another player is validated before reaching the game state. */
export const parseMsg = (raw: unknown): BattleMsg | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const message = raw as Record<string, unknown>;
  switch (message.t) {
    case 'hello':
      return typeof message.name === 'string'
        ? { t: 'hello', name: cleanName(message.name) || 'Amigo' }
        : null;
    case 'start':
      return { t: 'start' };
    case 'attack': {
      const id = typeof message.id === 'string' ? message.id.slice(0, 40) : '';
      if (!id) return null;
      const cell = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= N - 2;
      if (message.kind === 'garbage' && Number.isInteger(message.n) && (message.n as number) >= 1 && (message.n as number) <= 8)
        return { t: 'attack', id, kind: 'garbage', n: message.n as number };
      if (message.kind === 'freeze') return { t: 'attack', id, kind: 'freeze' };
      if (message.kind === 'rubble' && cell(message.r) && cell(message.c))
        return { t: 'attack', id, kind: 'rubble', r: message.r as number, c: message.c as number };
      return null;
    }
    case 'bye':
      return { t: 'bye' };
    case 'state':
      if (
        !isCount(message.score) ||
        !isCount(message.combo) ||
        typeof message.over !== 'boolean' ||
        !validGrid(message.grid)
      ) {
        return null;
      }
      return {
        t: 'state',
        score: message.score,
        combo: message.combo,
        over: message.over,
        grid: message.grid,
      };
    default:
      return null;
  }
};

interface RoomResult {
  code: string;
  conn: Connection;
}

const connectRoom = async (
  action: { t: 'create' } | { t: 'join'; code: string },
  handlers: Handlers,
): Promise<RoomResult> => {
  const socket = await backend.openBattleSocket();

  return new Promise((resolve, reject) => {
    let connected = false;
    let completed = false;
    let intentionallyClosed = false;
    let fatalReported = false;
    const timer = setTimeout(() => fail(ERR_SERVER), 20_000);

    const fail = (message: string) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      socket.close();
      reject(new Error(message));
    };

    const connection: Connection = {
      send(message) {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify(message));
      },
      close() {
        intentionallyClosed = true;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ t: 'bye' } satisfies BattleMsg));
        }
        if (socket.readyState < WebSocket.CLOSING) socket.close();
      },
    };

    socket.onopen = () => socket.send(JSON.stringify(action));
    socket.onmessage = event => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const control = raw as Record<string, unknown>;

      if (control.t === 'room' || control.t === 'joined') {
        if (
          typeof control.code !== 'string' ||
          control.code.length !== CODE_LEN
        ) {
          fail(ERR_SERVER);
          return;
        }
        connected = true;
        completed = true;
        clearTimeout(timer);
        resolve({ code: control.code, conn: connection });
      } else if (control.t === 'peerJoined') {
        handlers.onPeerJoined();
      } else if (control.t === 'peerLeft') {
        handlers.onPeerLeft();
      } else if (control.t === 'error') {
        const message =
          typeof control.message === 'string' ? control.message : ERR_SERVER;
        if (connected) handlers.onFatal(message);
        else
          fail(
            message === 'Sala não encontrada. Confira o código.'
              ? ERR_NOT_FOUND
              : message,
          );
      } else {
        const message = parseMsg(raw);
        if (!message) return;
        if (message.t === 'bye') {
          intentionallyClosed = true;
          handlers.onPeerLeft();
          socket.close();
        } else {
          handlers.onMessage(message);
        }
      }
    };
    socket.onerror = () => {
      if (connected && !fatalReported) {
        fatalReported = true;
        handlers.onFatal(ERR_SERVER);
      } else {
        fail(ERR_SERVER);
      }
    };
    socket.onclose = () => {
      clearTimeout(timer);
      if (!completed) {
        completed = true;
        reject(new Error(ERR_SERVER));
      } else if (connected && !intentionallyClosed && !fatalReported) {
        fatalReported = true;
        handlers.onFatal(ERR_SERVER);
      }
    };
  });
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
const makeCode = (): string => {
  const bytes = new Uint8Array(CODE_LEN);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (x) => ALPHABET[x % ALPHABET.length]).join('');
};

// ---------------------------------------------------------------- Supabase Realtime (web + Android + iOS)
// Cada sala é um canal "tycoon-room-CODE": presença diz quem está na sala, broadcast leva as jogadas.
type Channel = ReturnType<NonNullable<typeof supabase>['channel']>;
type Role = 'host' | 'guest';

const roomChannel = (code: string) => `tycoon-room-${code}`;
const randomKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const openSupabaseRoom = (code: string, role: Role, h: Handlers): Promise<Connection> =>
  new Promise((resolve, reject) => {
    const sb = supabase!;
    const me = randomKey();
    const ch: Channel = sb.channel(roomChannel(code), {
      config: { broadcast: { self: false }, presence: { key: me } },
    });
    let settled = false;
    let peerHere = false;
    let closed = false;

    const conn: Connection = {
      send: (msg) => {
        if (!closed) void ch.send({ type: 'broadcast', event: 'm', payload: msg });
      },
      close: () => {
        if (closed) return;
        void ch.send({ type: 'broadcast', event: 'm', payload: { t: 'bye' } satisfies BattleMsg });
        closed = true;
        setTimeout(() => void sb.removeChannel(ch), 200);
      },
    };
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      closed = true;
      void sb.removeChannel(ch);
      reject(new Error(msg));
    };
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(conn);
    };
    const timer = setTimeout(() => fail(role === 'guest' ? ERR_NOT_FOUND : ERR_SERVER), role === 'guest' ? 9000 : 12000);

    const others = () =>
      Object.entries(ch.presenceState() as Record<string, { role?: Role }[]>)
        .filter(([k]) => k !== me)
        .map(([, metas]) => metas[0]?.role);

    ch.on('broadcast', { event: 'm' }, ({ payload }: { payload: unknown }) => {
      if (closed) return;
      const m = parseMsg(payload);
      if (!m) return;
      if (m.t === 'bye') {
        if (peerHere) {
          peerHere = false;
          h.onPeerLeft();
        }
      } else h.onMessage(m);
    });

    ch.on('presence', { event: 'sync' }, () => {
      if (closed) return;
      const roles = others();
      if (role === 'host') {
        const here = roles.includes('guest');
        if (here && !peerHere) {
          peerHere = true;
          h.onPeerJoined();
        } else if (!here && peerHere) {
          peerHere = false;
          h.onPeerLeft();
        }
      } else {
        const hostHere = roles.includes('host');
        if (!settled) {
          if (!hostHere) return; // espera o anfitrião aparecer (ou o tempo esgotar)
          if (roles.filter((r) => r === 'guest').length > 0) return fail('Sala cheia: já tem dois jogadores.');
          peerHere = true;
          done();
        } else if (!hostHere && peerHere) {
          peerHere = false;
          h.onPeerLeft();
        }
      }
    });

    ch.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ role, at: Date.now() });
        if (role === 'host') done();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!settled) fail(ERR_SERVER);
        else if (!closed) h.onFatal(ERR_SERVER);
      }
    });
  });

export async function createRoom(handlers: Handlers): Promise<RoomResult> {
  if (supabase) {
    const code = makeCode();
    return { code, conn: await openSupabaseRoom(code, 'host', handlers) };
  }
  return connectRoom({ t: 'create' }, handlers);
}

export async function joinRoom(
  rawCode: string,
  handlers: Handlers,
): Promise<Connection> {
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LEN)
    throw new Error('Digite o código de 5 caracteres da sala.');
  if (supabase) return openSupabaseRoom(code, 'guest', handlers);
  const { conn } = await connectRoom({ t: 'join', code }, handlers);
  return conn;
}
