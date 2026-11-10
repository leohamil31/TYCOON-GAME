import { createHash, randomBytes, randomInt } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  COIN_PACKS,
  coinsForScore,
  DEFAULT_BOARD,
  ITEMS,
  itemById,
  MAX_RUN_SCORE,
  packById,
} from '../../src/shop/catalog';
import {
  cleanPlayerName,
  isUserCode,
  normalizeUserCode,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  type ApiErrorCode,
  type Friend,
  type Profile,
} from '../../src/shop/types';
import type { Db, Query } from './db';

const ONLINE_WINDOW_MS = 25_000;
const MAX_FRIENDS = 100;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const newCode = () =>
  Array.from({ length: USER_CODE_LENGTH }, () => USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]).join('');

interface UserRow {
  id: number;
  code: string;
  name: string;
  coins: number;
  best: number;
  equipped: string;
}

const intOf = (v: unknown, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, 'invalid', 'Valor inválido.');
  }
  return v;
};
const strOf = (v: unknown, max = 40): string => {
  if (typeof v !== 'string' || !v || v.length > max) throw new HttpError(400, 'invalid', 'Valor inválido.');
  return v;
};

async function loadProfile(q: Query, userId: number): Promise<Profile> {
  const [u] = await q<UserRow>('SELECT id, code, name, coins, best, equipped FROM users WHERE id = $1', [userId]);
  if (!u) throw new HttpError(401, 'unauthorized', 'Sessão inválida.');
  const inv = await q<{ item_id: string; qty: number }>('SELECT item_id, qty FROM inventory WHERE user_id = $1', [
    userId,
  ]);
  const owned = new Set(inv.filter((r) => Number(r.qty) > 0).map((r) => r.item_id));
  const boards = ITEMS.filter((i) => i.kind === 'board' && (i.price === 0 || owned.has(i.id))).map((i) => i.id);
  const inventory: Record<string, number> = {};
  for (const i of ITEMS) {
    if (i.kind !== 'consumable') continue;
    const row = inv.find((r) => r.item_id === i.id);
    if (row && Number(row.qty) > 0) inventory[i.id] = Number(row.qty);
  }
  return {
    userId: u.code,
    name: u.name,
    coins: Number(u.coins),
    best: Number(u.best),
    inventory,
    boards,
    equipped: boards.includes(u.equipped) ? u.equipped : DEFAULT_BOARD,
  };
}

const ledger = (q: Query, userId: number, kind: string, itemId: string | null, coins: number, cents: number) =>
  q('INSERT INTO transactions (user_id, kind, item_id, delta_coins, real_cents, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [
    userId,
    kind,
    itemId,
    coins,
    cents,
    Date.now(),
  ]);

/** Entrega um item já pago (moedas debitadas ou compra real aprovada). */
async function grant(q: Query, userId: number, itemId: string, qty = 1): Promise<void> {
  const item = itemById(itemId);
  if (!item) throw new HttpError(404, 'not_found', 'Item não encontrado.');
  const [row] = await q<{ qty: number }>('SELECT qty FROM inventory WHERE user_id = $1 AND item_id = $2', [
    userId,
    itemId,
  ]);
  if (item.kind === 'board') {
    if (row && Number(row.qty) > 0) throw new HttpError(409, 'already_owned', 'Você já possui este tabuleiro.');
    if (row) await q('UPDATE inventory SET qty = 1 WHERE user_id = $1 AND item_id = $2', [userId, itemId]);
    else await q('INSERT INTO inventory (user_id, item_id, qty) VALUES ($1,$2,1)', [userId, itemId]);
    return;
  }
  if (row) await q('UPDATE inventory SET qty = qty + $3 WHERE user_id = $1 AND item_id = $2', [userId, itemId, qty]);
  else await q('INSERT INTO inventory (user_id, item_id, qty) VALUES ($1,$2,$3)', [userId, itemId, qty]);
}

const ownsBoard = async (q: Query, userId: number, boardId: string): Promise<boolean> => {
  const item = itemById(boardId);
  if (!item || item.kind !== 'board') return false;
  if (item.price === 0) return true;
  const [r] = await q<{ qty: number }>('SELECT qty FROM inventory WHERE user_id = $1 AND item_id = $2', [userId, boardId]);
  return !!r && Number(r.qty) > 0;
};

export interface AppOptions {
  /** Libera a rota de compra real SIMULADA. Em produção, troque por validação de recibo (App Store / Play). */
  allowSimulatedIap: boolean;
  corsOrigin?: string;
}

type AuthedRequest = Request & { userId: number };
type Handler = (req: AuthedRequest, res: Response) => Promise<unknown>;

export function createApp(db: Db, opts: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', opts.corsOrigin ?? '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });

  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
      void fn(req, res).catch(next);

  const authed = (fn: Handler) =>
    wrap(async (req, res) => {
      const m = /^Bearer ([a-f0-9]{48})$/.exec(req.headers.authorization ?? '');
      if (!m) throw new HttpError(401, 'unauthorized', 'Faça login.');
      const [u] = await db.query<{ id: number }>('SELECT id FROM users WHERE token_hash = $1', [sha256(m[1])]);
      if (!u) throw new HttpError(401, 'unauthorized', 'Sessão inválida.');
      (req as AuthedRequest).userId = Number(u.id);
      return fn(req as AuthedRequest, res);
    });

  app.get('/api/health', (_req, res) => void res.json({ ok: true }));
  app.get('/api/catalog', (_req, res) => void res.json({ items: ITEMS, coinPacks: COIN_PACKS }));

  // ---------- Conta ----------
  app.post(
    '/api/auth/guest',
    wrap(async (req, res) => {
      const name = cleanPlayerName(req.body?.name);
      const token = randomBytes(24).toString('hex');
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const [u] = await db.query<{ id: number }>(
            'INSERT INTO users (code, token_hash, name, created_at) VALUES ($1,$2,$3,$4) RETURNING id',
            [newCode(), sha256(token), name, Date.now()],
          );
          const profile = await loadProfile(db.query, Number(u.id));
          return void res.status(201).json({ token, profile });
        } catch (e) {
          if (!/unique|duplicate/i.test(String((e as Error).message))) throw e;
        }
      }
      throw new Error('Não foi possível gerar um código de jogador.');
    }),
  );

  app.get('/api/me', authed(async (req, res) => res.json(await loadProfile(db.query, req.userId))));

  app.post(
    '/api/me/name',
    authed(async (req, res) => {
      await db.query('UPDATE users SET name = $1 WHERE id = $2', [cleanPlayerName(req.body?.name), req.userId]);
      res.json(await loadProfile(db.query, req.userId));
    }),
  );

  // Pontuação enviada pelo cliente: o servidor limita o valor e paga moedas só pela diferença
  // (revive da mesma partida não paga duas vezes). Para jogo competitivo real, valide as jogadas no servidor.
  app.post(
    '/api/me/run',
    authed(async (req, res) => {
      const runId = strOf(req.body?.runId);
      const score = intOf(req.body?.score, 0, MAX_RUN_SCORE);
      const profile = await db.tx(async (q) => {
        await q('UPDATE users SET coins = coins WHERE id = $1', [req.userId]); // trava a linha do usuário
        const [prev] = await q<{ score: number; coins_paid: number }>(
          'SELECT score, coins_paid FROM runs WHERE user_id = $1 AND run_id = $2',
          [req.userId, runId],
        );
        const bestOfRun = Math.max(prev ? Number(prev.score) : 0, score);
        const paid = prev ? Number(prev.coins_paid) : 0;
        const delta = Math.max(0, coinsForScore(bestOfRun) - paid);
        if (prev) {
          await q('UPDATE runs SET score = $3, coins_paid = $4 WHERE user_id = $1 AND run_id = $2', [
            req.userId,
            runId,
            bestOfRun,
            paid + delta,
          ]);
        } else {
          await q('INSERT INTO runs (user_id, run_id, score, coins_paid) VALUES ($1,$2,$3,$4)', [
            req.userId,
            runId,
            bestOfRun,
            delta,
          ]);
        }
        const [u] = await q<{ best: number }>('SELECT best FROM users WHERE id = $1', [req.userId]);
        await q('UPDATE users SET coins = coins + $2, best = $3 WHERE id = $1', [
          req.userId,
          delta,
          Math.max(Number(u.best), bestOfRun),
        ]);
        if (delta > 0) await ledger(q, req.userId, 'run_reward', null, delta, 0);
        return loadProfile(q, req.userId);
      });
      res.json(profile);
    }),
  );

  // ---------- Loja ----------
  app.post(
    '/api/shop/purchase',
    authed(async (req, res) => {
      const item = itemById(strOf(req.body?.itemId));
      if (!item || item.price <= 0) throw new HttpError(404, 'not_found', 'Item não está à venda.');
      const qty = item.kind === 'consumable' ? intOf(req.body?.qty ?? 1, 1, 10) : 1;
      const cost = item.price * qty;
      const profile = await db.tx(async (q) => {
        if (item.kind === 'board' && (await ownsBoard(q, req.userId, item.id))) {
          throw new HttpError(409, 'already_owned', 'Você já possui este tabuleiro.');
        }
        // Débito atômico: só passa se o saldo cobrir o preço.
        const paid = await q('UPDATE users SET coins = coins - $2::int WHERE id = $1 AND coins >= $2::int RETURNING id', [
          req.userId,
          cost,
        ]);
        if (paid.length === 0) throw new HttpError(402, 'insufficient_funds', 'Moedas insuficientes.');
        await grant(q, req.userId, item.id, qty);
        await ledger(q, req.userId, 'purchase', item.id, -cost, 0);
        return loadProfile(q, req.userId);
      });
      res.json(profile);
    }),
  );

  app.post(
    '/api/shop/iap-simulated',
    authed(async (req, res) => {
      if (!opts.allowSimulatedIap) throw new HttpError(403, 'forbidden', 'Compras simuladas desativadas.');
      const sku = strOf(req.body?.sku);
      const pack = packById(sku);
      const item = itemById(sku);
      if (!pack && !(item && item.kind === 'board' && item.realCents)) {
        throw new HttpError(404, 'not_found', 'Produto não encontrado.');
      }
      const profile = await db.tx(async (q) => {
        if (pack) {
          await q('UPDATE users SET coins = coins + $2 WHERE id = $1', [req.userId, pack.coins]);
          await ledger(q, req.userId, 'iap_simulated', pack.id, pack.coins, pack.realCents);
        } else if (item) {
          await grant(q, req.userId, item.id);
          await ledger(q, req.userId, 'iap_simulated', item.id, 0, item.realCents ?? 0);
        }
        return loadProfile(q, req.userId);
      });
      res.json(profile);
    }),
  );

  app.post(
    '/api/inventory/consume',
    authed(async (req, res) => {
      const item = itemById(strOf(req.body?.itemId));
      if (!item || item.kind !== 'consumable') throw new HttpError(404, 'not_found', 'Item inválido.');
      const used = await db.query(
        'UPDATE inventory SET qty = qty - 1 WHERE user_id = $1 AND item_id = $2 AND qty > 0 RETURNING qty',
        [req.userId, item.id],
      );
      if (used.length === 0) throw new HttpError(409, 'not_owned', 'Você não tem este item.');
      res.json(await loadProfile(db.query, req.userId));
    }),
  );

  /** Valida (no servidor) que o jogador pode usar o tabuleiro e o equipa. */
  app.post(
    '/api/boards/equip',
    authed(async (req, res) => {
      const boardId = strOf(req.body?.boardId);
      if (!(await ownsBoard(db.query, req.userId, boardId))) {
        throw new HttpError(403, 'not_owned', 'Tabuleiro bloqueado. Compre na loja para usar.');
      }
      await db.query('UPDATE users SET equipped = $2 WHERE id = $1', [req.userId, boardId]);
      res.json(await loadProfile(db.query, req.userId));
    }),
  );

  // ---------- Social ----------
  app.post(
    '/api/presence',
    authed(async (req, res) => {
      const score = intOf(req.body?.score ?? 0, 0, MAX_RUN_SCORE);
      await db.query('UPDATE users SET live_score = $2, last_seen = $3 WHERE id = $1', [req.userId, score, Date.now()]);
      res.json({ ok: true });
    }),
  );

  const listFriends = async (userId: number): Promise<Friend[]> => {
    const rows = await db.query<{ code: string; name: string; best: number; live_score: number; last_seen: number }>(
      `SELECT u.code, u.name, u.best, u.live_score, u.last_seen
         FROM friendships f JOIN users u ON u.id = f.friend_id
        WHERE f.user_id = $1`,
      [userId],
    );
    const now = Date.now();
    return rows
      .map((r) => {
        const online = now - Number(r.last_seen) < ONLINE_WINDOW_MS;
        return { id: r.code, name: r.name, online, score: online ? Number(r.live_score) : 0, best: Number(r.best) };
      })
      .sort((a, b) => b.best - a.best);
  };

  app.get('/api/friends', authed(async (req, res) => res.json(await listFriends(req.userId))));

  app.post(
    '/api/friends',
    authed(async (req, res) => {
      const code = normalizeUserCode(strOf(req.body?.code, 32));
      if (!isUserCode(code)) throw new HttpError(400, 'invalid', 'Código de amigo inválido.');
      const [target] = await db.query<{ id: number }>('SELECT id FROM users WHERE code = $1', [code]);
      if (!target) throw new HttpError(404, 'not_found', 'Nenhum jogador com esse código.');
      const friendId = Number(target.id);
      if (friendId === req.userId) throw new HttpError(400, 'self', 'Esse é o seu próprio código.');
      await db.tx(async (q) => {
        const [{ n }] = await q<{ n: number }>('SELECT COUNT(*) AS n FROM friendships WHERE user_id = $1', [req.userId]);
        if (Number(n) >= MAX_FRIENDS) throw new HttpError(400, 'invalid', 'Limite de amigos atingido.');
        for (const [a, b] of [
          [req.userId, friendId],
          [friendId, req.userId],
        ]) {
          const exists = await q('SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2', [a, b]);
          if (exists.length === 0) await q('INSERT INTO friendships (user_id, friend_id) VALUES ($1,$2)', [a, b]);
        }
      });
      res.status(201).json(await listFriends(req.userId));
    }),
  );

  app.delete(
    '/api/friends/:code',
    authed(async (req, res) => {
      const code = normalizeUserCode(String(req.params.code));
      await db.query(
        `DELETE FROM friendships
          WHERE (user_id = $1 AND friend_id IN (SELECT id FROM users WHERE code = $2))
             OR (friend_id = $1 AND user_id IN (SELECT id FROM users WHERE code = $2))`,
        [req.userId, code],
      );
      res.json(await listFriends(req.userId));
    }),
  );

  app.use((_req, res) => void res.status(404).json({ error: 'not_found', message: 'Rota inexistente.' }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.code, message: err.message });
    if ((err as { type?: string })?.type === 'entity.parse.failed') {
      return void res.status(400).json({ error: 'invalid', message: 'JSON inválido.' });
    }
    console.error(err);
    res.status(500).json({ error: 'invalid', message: 'Erro interno.' });
  });

  return app;
}
