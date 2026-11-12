import type { DataConnection, Peer as PeerInstance } from 'peerjs';
import { BLOCK_COLORS, GAME } from '../constants';
import { cleanName } from '../storage';
import { supabase } from './supabase';
import type { Grid } from '../types';
import { loadPeer, type PeerCtor } from './loadPeer';

/**
 * Real-time transport for friend battles.
 *
 * Uses PeerJS (WebRTC data channels) in browsers and its React Native WebRTC adapter in the apps.
 * The room code is the host's peer id; the public PeerJS signalling server introduces the players,
 * then game traffic flows peer-to-peer.
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

const PREFIX = 'tycoon-game-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const CODE_LEN = 5;
const N = GAME.GRID_SIZE;

const ERR_SERVER = 'Sem conexão com o servidor de salas. Verifique a internet.';
const ERR_NOT_FOUND = 'Sala não encontrada. Confira o código.';

class IdTaken extends Error {}

export const normalizeCode = (raw: string): string =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);

const makeCode = (): string => {
  const bytes = new Uint8Array(CODE_LEN);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10_000_000;

const validGrid = (g: unknown): g is Grid =>
  Array.isArray(g) &&
  g.length === N &&
  g.every(
    (row) =>
      Array.isArray(row) &&
      row.length === N &&
      row.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v < BLOCK_COLORS.length)),
  );

/** Everything coming from the other player is untrusted: validate shape and ranges. */
export const parseMsg = (raw: unknown): BattleMsg | null => {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      return { t: 'hello', name: cleanName(m.name) || 'Amigo' };
    case 'start':
      return { t: 'start' };
    case 'bye':
      return { t: 'bye' };
    case 'state':
      if (!isCount(m.score) || !isCount(m.combo) || typeof m.over !== 'boolean' || !validGrid(m.grid)) return null;
      return { t: 'state', score: m.score, combo: m.combo, over: m.over, grid: m.grid };
    default:
      return null;
  }
};

const describe = (type: string): string => {
  if (type === 'peer-unavailable') return ERR_NOT_FOUND;
  return ERR_SERVER;
};

const attach = (c: DataConnection, h: Handlers, onClose: () => void) => {
  c.on('data', (d) => {
    const m = parseMsg(d);
    if (!m) return;
    if (m.t === 'bye') c.close();
    else h.onMessage(m);
  });
  c.on('close', onClose);
  c.on('error', () => {});
};

const makeConnection = (c: () => DataConnection | null, peer: PeerInstance): Connection => ({
  send: (msg) => {
    const conn = c();
    if (conn?.open) conn.send(msg);
  },
  close: () => {
    try {
      c()?.send({ t: 'bye' } satisfies BattleMsg);
    } catch {
      /* already closed */
    }
    // Give the "bye" a moment to flush before tearing the peer down.
    setTimeout(() => peer.destroy(), 150);
  },
});

const openHost = (Peer: PeerCtor, code: string, h: Handlers): Promise<Connection> =>
  new Promise((resolve, reject) => {
    const peer = new Peer(PREFIX + code);
    let active: DataConnection | null = null;
    let opened = false;
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error(ERR_SERVER));
    }, 12000);

    peer.on('open', () => {
      opened = true;
      clearTimeout(timer);
      resolve(makeConnection(() => active, peer));
    });

    peer.on('error', (err) => {
      if (!opened) {
        clearTimeout(timer);
        peer.destroy();
        reject(err.type === 'unavailable-id' ? new IdTaken() : new Error(describe(err.type)));
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        h.onFatal(ERR_SERVER);
      }
    });

    peer.on('connection', (c) => {
      if (active?.open) {
        // Room is full: only one challenger at a time.
        c.on('open', () => c.close());
        return;
      }
      active = c;
      c.on('open', () => h.onPeerJoined());
      attach(c, h, () => {
        if (active === c) {
          active = null;
          h.onPeerLeft();
        }
      });
    });
  });

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

export async function createRoom(h: Handlers): Promise<{ code: string; conn: Connection }> {
  if (supabase) {
    const code = makeCode();
    return { code, conn: await openSupabaseRoom(code, 'host', h) };
  }
  const Peer = await loadPeer();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      return { code, conn: await openHost(Peer, code, h) };
    } catch (e) {
      if (!(e instanceof IdTaken)) throw e;
    }
  }
  throw new Error('Não foi possível criar a sala. Tente novamente.');
}

export async function joinRoom(rawCode: string, h: Handlers): Promise<Connection> {
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LEN) throw new Error('Digite o código de 5 caracteres da sala.');
  if (supabase) return openSupabaseRoom(code, 'guest', h);
  const Peer = await loadPeer();

  return new Promise((resolve, reject) => {
    const peer = new Peer();
    let opened = false;
    let active: DataConnection | null = null;
    const fail = (msg: string) => {
      clearTimeout(timer);
      peer.destroy();
      reject(new Error(msg));
    };
    const timer = setTimeout(() => fail(ERR_NOT_FOUND), 15000);

    peer.on('error', (err) => {
      if (!opened) fail(describe(err.type));
      else h.onFatal(ERR_SERVER);
    });

    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      active = c;
      attach(c, h, () => {
        if (opened) h.onPeerLeft();
      });
      c.on('open', () => {
        opened = true;
        clearTimeout(timer);
        resolve(makeConnection(() => active, peer));
      });
    });
  });
}
