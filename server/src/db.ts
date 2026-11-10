import type { Pool } from 'pg';

/** Executa SQL; dentro de `tx` todas as queries rodam na mesma transação. */
export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface Db {
  query: Query;
  tx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  token_hash  TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  coins       INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  best        INTEGER NOT NULL DEFAULT 0,
  equipped    TEXT NOT NULL DEFAULT 'classic',
  live_score  INTEGER NOT NULL DEFAULT 0,
  last_seen   BIGINT NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS friendships (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, friend_id)
);
CREATE TABLE IF NOT EXISTS inventory (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty     INTEGER NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS runs (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id     TEXT NOT NULL,
  score      INTEGER NOT NULL,
  coins_paid INTEGER NOT NULL,
  PRIMARY KEY (user_id, run_id)
);
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  item_id     TEXT,
  delta_coins INTEGER NOT NULL DEFAULT 0,
  real_cents  INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL
);
`;

/** Adapta um `pg.Pool` (real ou do pg-mem) para a interface `Db`. */
export function dbFromPool(pool: Pool): Db {
  const query: Query = async (sql, params) => (await pool.query(sql, params as unknown[])).rows;
  return {
    query,
    async tx(fn) {
      const client = await pool.connect();
      const q: Query = async (sql, params) => (await client.query(sql, params as unknown[])).rows;
      try {
        await client.query('BEGIN');
        const out = await fn(q);
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

export async function migrate(db: Db): Promise<void> {
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
}
