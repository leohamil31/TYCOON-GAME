import type { SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  coinsForScore,
  DEFAULT_BOARD,
  itemById,
  MAX_RUN_SCORE,
  packById,
  isCosmetic,
  type ShopItem,
} from '../shop/catalog';
import {
  cleanPlayerName,
  isUserCode,
  normalizeUserCode,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  type ApiErrorCode,
  type Friend,
  type Profile,
  type RankEntry,
} from '../shop/types';
import { ensureSession, supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Tudo que o app precisa do "servidor". Há duas implementações: HTTP (server/) e local (demonstração). */
export interface Backend {
  readonly mode: 'remote' | 'local';
  init(name: string): Promise<Profile>;
  setName(name: string): Promise<Profile>;
  reportRun(runId: string, score: number): Promise<Profile>;
  purchase(itemId: string, qty?: number): Promise<Profile>;
  /** Compra com dinheiro real SIMULADA (pacote de moedas ou tabuleiro premium). */
  simulatedIap(sku: string): Promise<Profile>;
  equipBoard(boardId: string): Promise<Profile>;
  consume(itemId: string): Promise<Profile>;
  heartbeat(score: number): Promise<void>;
  openBattleSocket(): Promise<WebSocket>;
  /** Ranking global ou de amigos (só com servidor). */
  leaderboard?(scope: 'global' | 'friends'): Promise<RankEntry[]>;
  /** Registra o resultado de uma batalha (vitórias no ranking). */
  reportBattle?(matchId: string, score: number, won: boolean): Promise<Profile>;
  listFriends(): Promise<Friend[]>;
  addFriend(code: string): Promise<Friend[]>;
  removeFriend(code: string): Promise<Friend[]>;
}

/**
 * Servidor próprio (server/ no Render, ver server/DEPLOY.md). Só é usado quando definido explicitamente
 * (TYCOON_API_URL ou EXPO_PUBLIC_API_URL) e o Supabase não está configurado; ex.:
 * 'https://tycoon-game-api-leohamil31.onrender.com'.
 */
const API_URL: string | undefined = (() => {
  const g = globalThis as { TYCOON_API_URL?: string; process?: { env?: Record<string, string | undefined> } };
  const url = g.TYCOON_API_URL ?? g.process?.env?.EXPO_PUBLIC_API_URL;
  return url ? url.replace(/\/+$/, '') : undefined;
})();

const TOKEN_KEY = '@tycoon/token_v1';
const LOCAL_KEY = '@tycoon/local_profile_v1';

// ---------------------------------------------------------------- remoto (Node + PostgreSQL)
function remoteBackend(baseUrl: string): Backend {
  let token: string | null = null;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('network', 'Sem conexão com o servidor.');
    }
    const json = (await res.json().catch(() => ({}))) as { error?: ApiErrorCode; message?: string };
    if (!res.ok) throw new ApiError(json.error ?? 'invalid', json.message ?? 'Erro inesperado.');
    return json as T;
  }

  async function register(name: string): Promise<Profile> {
    const r = await request<{ token: string; profile: Profile }>('POST', '/auth/guest', { name });
    token = r.token;
    await AsyncStorage.setItem(TOKEN_KEY, r.token);
    return r.profile;
  }

  return {
    mode: 'remote',
    async init(name) {
      token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          return await request<Profile>('GET', '/me');
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'unauthorized') throw e;
        }
      }
      return register(name);
    },
    setName: (name) => request('POST', '/me/name', { name }),
    reportRun: (runId, score) => request('POST', '/me/run', { runId, score: Math.floor(score) }),
    purchase: (itemId, qty = 1) => request('POST', '/shop/purchase', { itemId, qty }),
    simulatedIap: (sku) => request('POST', '/shop/iap-simulated', { sku }),
    equipBoard: (boardId) => request('POST', '/boards/equip', { boardId }),
    consume: (itemId) => request('POST', '/inventory/consume', { itemId }),
    async heartbeat(score) {
      await request('POST', '/presence', { score: Math.floor(score) });
    },
    async openBattleSocket() {
      const { ticket } = await request<{ ticket: string }>('POST', '/battle/ticket');
      const wsBase = baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
      return new WebSocket(`${wsBase}/battle?ticket=${encodeURIComponent(ticket)}`);
    },
    listFriends: () => request('GET', '/friends'),
    addFriend: (code) => request('POST', '/friends', { code }),
    removeFriend: (code) => request('DELETE', `/friends/${normalizeUserCode(code)}`),
  };
}

// ---------------------------------------------------------------- local (demonstração, sem servidor)
interface LocalState {
  profile: Profile;
  runs: Record<string, { score: number; paid: number }>;
  friends: string[];
}

const NAMES = ['Luna', 'Kai', 'Nina', 'Theo', 'Zeca', 'Mia', 'Bento', 'Aria', 'Duda', 'Nico'];
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Amigo fictício determinístico: só existe para mostrar a interface sem servidor. */
function simulatedFriend(code: string, now: number): Friend {
  const h = hash(code);
  const best = 800 + (h % 9000);
  const online = Math.floor(now / 45000 + h) % 3 !== 0;
  const score = online ? Math.floor(best * 0.15 + (((now / 1000) + h) % 180) * 5) : 0;
  return { id: code, name: NAMES[h % NAMES.length], online, score, best, simulated: true };
}

const randomCode = () =>
  Array.from({ length: USER_CODE_LENGTH }, () => USER_CODE_ALPHABET[Math.floor(Math.random() * USER_CODE_ALPHABET.length)]).join('');

function localBackend(): Backend {
  let st: LocalState | null = null;

  const save = async (): Promise<Profile> => {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(st));
    return structuredCloneProfile(st!.profile);
  };
  const structuredCloneProfile = (p: Profile): Profile => ({ ...p, boards: [...p.boards], inventory: { ...p.inventory } });
  const need = (): LocalState => {
    if (!st) throw new ApiError('unauthorized', 'Perfil não carregado.');
    return st;
  };
  const grant = (item: ShopItem, qty: number) => {
    const p = need().profile;
    if (isCosmetic(item.kind)) {
      if (p.boards.includes(item.id)) throw new ApiError('already_owned', 'Você já possui este item.');
      p.boards.push(item.id);
    } else if (item.kind === 'bundle') {
      Object.entries(item.grants ?? {}).forEach(([id, n]) => (p.inventory[id] = (p.inventory[id] ?? 0) + n * qty));
    } else p.inventory[item.id] = (p.inventory[item.id] ?? 0) + qty;
  };

  return {
    mode: 'local',
    async init(name) {
      try {
        const raw = await AsyncStorage.getItem(LOCAL_KEY);
        const d = raw ? (JSON.parse(raw) as LocalState) : null;
        if (d?.profile && isUserCode(d.profile.userId) && Array.isArray(d.profile.boards)) st = d;
      } catch {
        st = null;
      }
      if (!st) {
        st = {
          profile: {
            userId: randomCode(),
            name: cleanPlayerName(name),
            coins: 0,
            best: 0,
            inventory: {},
            boards: [DEFAULT_BOARD],
            equipped: DEFAULT_BOARD,
          },
          runs: {},
          friends: [],
        };
      }
      return save();
    },
    async setName(name) {
      need().profile.name = cleanPlayerName(name);
      return save();
    },
    async reportRun(runId, score) {
      const s = need();
      const sc = Math.min(Math.max(0, Math.floor(score)), MAX_RUN_SCORE);
      const prev = s.runs[runId] ?? { score: 0, paid: 0 };
      const bestOfRun = Math.max(prev.score, sc);
      const delta = Math.max(0, coinsForScore(bestOfRun) - prev.paid);
      s.runs[runId] = { score: bestOfRun, paid: prev.paid + delta };
      s.profile.coins += delta;
      s.profile.best = Math.max(s.profile.best, bestOfRun);
      return save();
    },
    async purchase(itemId, qty = 1) {
      const p = need().profile;
      const item = itemById(itemId);
      if (!item || item.price <= 0) throw new ApiError('not_found', 'Item não está à venda.');
      const n = item.kind === 'consumable' ? Math.min(10, Math.max(1, Math.floor(qty))) : 1;
      if (isCosmetic(item.kind) && p.boards.includes(item.id)) throw new ApiError('already_owned', 'Você já possui este item.');
      if (p.coins < item.price * n) throw new ApiError('insufficient_funds', 'Moedas insuficientes.');
      p.coins -= item.price * n;
      grant(item, n);
      return save();
    },
    async simulatedIap(sku) {
      const p = need().profile;
      const pack = packById(sku);
      const item = itemById(sku);
      if (pack) p.coins += pack.coins;
      else if (item && item.kind === 'board' && item.realCents) grant(item, 1);
      else throw new ApiError('not_found', 'Produto não encontrado.');
      return save();
    },
    async equipBoard(id) {
      const p = need().profile;
      const item = itemById(id);
      if (!item || !isCosmetic(item.kind)) throw new ApiError('not_found', 'Item inválido.');
      if (item.price > 0 && !p.boards.includes(id)) throw new ApiError('not_owned', 'Bloqueado. Compre na loja para usar.');
      if (item.kind === 'skin') p.skin = id;
      else if (item.kind === 'fx') p.effect = id;
      else p.equipped = id;
      return save();
    },
    async consume(itemId) {
      const p = need().profile;
      if ((p.inventory[itemId] ?? 0) <= 0) throw new ApiError('not_owned', 'Você não tem este item.');
      p.inventory[itemId] -= 1;
      if (p.inventory[itemId] === 0) delete p.inventory[itemId];
      return save();
    },
    async heartbeat() {},
    async openBattleSocket() {
      throw new ApiError('network', 'Partidas e amigos precisam do servidor online configurado.');
    },
    async listFriends() {
      const now = Date.now();
      return need()
        .friends.map((c) => simulatedFriend(c, now))
        .sort((a, b) => b.best - a.best);
    },
    async addFriend(raw) {
      const s = need();
      const code = normalizeUserCode(raw);
      if (!isUserCode(code)) throw new ApiError('invalid', 'Código de amigo inválido.');
      if (code === s.profile.userId) throw new ApiError('self', 'Esse é o seu próprio código.');
      if (!s.friends.includes(code)) s.friends.push(code);
      await save();
      return this.listFriends();
    },
    async removeFriend(raw) {
      const s = need();
      s.friends = s.friends.filter((c) => c !== normalizeUserCode(raw));
      await save();
      return this.listFriends();
    },
  };
}

// ---------------------------------------------------------------- Supabase (servidor gratuito)
const API_CODES: ApiErrorCode[] = ['network', 'unauthorized', 'not_found', 'insufficient_funds', 'already_owned', 'not_owned', 'invalid', 'self', 'forbidden'];

/** As funções SQL lançam 'codigo|mensagem'; erros de rede viram 'network'. */
const fromSupabase = (e: unknown): ApiError => {
  const msg = (e as { message?: string } | null)?.message ?? '';
  const [code, text] = msg.split('|');
  if (text && (API_CODES as string[]).includes(code)) return new ApiError(code as ApiErrorCode, text);
  if (/fetch|network|timeout|Failed/i.test(msg)) return new ApiError('network', 'Sem conexão com o servidor.');
  if (/anonymous/i.test(msg)) return new ApiError('unauthorized', 'Ative "Allow anonymous sign-ins" no Supabase (Authentication > Providers).');
  return new ApiError('invalid', msg || 'Erro inesperado no servidor.');
};

function supabaseBackend(sb: SupabaseClient): Backend {
  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let res: { data: unknown; error: unknown };
    try {
      res = await sb.rpc(fn, args ?? {});
    } catch (e) {
      throw fromSupabase(e);
    }
    if (res.error) throw fromSupabase(res.error);
    return res.data as T;
  }

  return {
    mode: 'remote',
    async init(name) {
      try {
        await ensureSession(sb);
      } catch (e) {
        throw fromSupabase(e);
      }
      return rpc<Profile>('init_profile', { p_name: cleanPlayerName(name) });
    },
    setName: (name) => rpc('set_name', { p_name: name }),
    reportRun: (runId, score) => rpc('report_run', { p_run_id: runId, p_score: Math.floor(score) }),
    purchase: (itemId, qty = 1) => rpc('purchase', { p_item: itemId, p_qty: qty }),
    simulatedIap: (sku) => rpc('simulated_iap', { p_sku: sku }),
    equipBoard: (boardId) => rpc('equip_board', { p_board: boardId }),
    consume: (itemId) => rpc('consume', { p_item: itemId }),
    async heartbeat(score) {
      await rpc('heartbeat', { p_score: Math.floor(score) });
    },
    async openBattleSocket() {
      // Com o Supabase as salas usam o Realtime dele (services/battle.ts), não um WebSocket próprio.
      throw new ApiError('invalid', 'Salas usam o Supabase Realtime.');
    },
    leaderboard: (scope) => rpc(scope === 'global' ? 'leaderboard_global' : 'leaderboard_friends'),
    reportBattle: (matchId, score, won) => rpc('report_battle', { p_match_id: matchId, p_score: Math.floor(score), p_won: won }),
    listFriends: () => rpc('list_friends'),
    addFriend: (code) => rpc('add_friend', { p_code: normalizeUserCode(code) }),
    removeFriend: (code) => rpc('remove_friend', { p_code: normalizeUserCode(code) }),
  };
}

// Prioridade: Supabase (servidor gratuito escolhido) > servidor próprio do server/ (Render) > demonstração local.
// O Render só é usado se definido explicitamente (TYCOON_API_URL/EXPO_PUBLIC_API_URL) ou sem Supabase em produção.
export const backend: Backend = supabase
  ? supabaseBackend(supabase)
  : API_URL
    ? remoteBackend(API_URL)
    : localBackend();

/** true quando amigos e batalhas passam por um servidor de verdade (qualquer aparelho). */
export const hasServer = backend.mode === 'remote';
