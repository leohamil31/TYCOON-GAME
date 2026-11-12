import { BLOCK_COLORS, GAME } from '../constants';
import { backend } from './api';
import { cleanName } from '../storage';
import type { Grid } from '../types';

/**
 * Central WebSocket transport for friend battles. The same room protocol works in web browsers,
 * Android, and iOS, without requiring the players' devices to accept peer-to-peer connections.
 */
export type BattleMsg =
  | { t: 'hello'; name: string }
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

export async function createRoom(handlers: Handlers): Promise<RoomResult> {
  return connectRoom({ t: 'create' }, handlers);
}

export async function joinRoom(
  rawCode: string,
  handlers: Handlers,
): Promise<Connection> {
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LEN)
    throw new Error('Digite o código de 5 caracteres da sala.');
  const { conn } = await connectRoom({ t: 'join', code }, handlers);
  return conn;
}
