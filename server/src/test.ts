import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { newDb } from 'pg-mem';
import { createApp } from './app';
import { dbFromPool, migrate } from './db';

const mem = newDb();
const { Pool } = mem.adapters.createPg();
const db = dbFromPool(new Pool());
await migrate(db);

const server = createApp(db, { allowSimulatedIap: true }).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

type Json = Record<string, any>;
async function call(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Json };
}

let passed = 0;
const ok = (name: string) => console.log(`  ok  ${name}`, ++passed && '');

try {
  const a = (await call('POST', '/auth/guest', undefined, { name: 'Ana<script>' })).json;
  const b = (await call('POST', '/auth/guest', undefined, { name: 'Beto' })).json;
  assert.equal(a.profile.name, 'Anascript');
  assert.equal(a.profile.coins, 0);
  assert.deepEqual(a.profile.boards, ['classic']);
  ok('cria contas (nome sanitizado, saldo 0, tabuleiro padrão)');

  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('GET', '/me', 'f'.repeat(48))).status, 401);
  ok('rotas exigem token válido');

  // Partida: 1000 pts = 50 moedas; reenviar a mesma partida só paga a diferença
  let r = await call('POST', '/me/run', a.token, { runId: 'r1', score: 1000 });
  assert.equal(r.json.coins, 50);
  r = await call('POST', '/me/run', a.token, { runId: 'r1', score: 1000 });
  assert.equal(r.json.coins, 50);
  r = await call('POST', '/me/run', a.token, { runId: 'r1', score: 1400 });
  assert.equal(r.json.coins, 70);
  assert.equal(r.json.best, 1400);
  assert.equal((await call('POST', '/me/run', a.token, { runId: 'x', score: 99999999 })).status, 400);
  assert.equal((await call('POST', '/me/run', a.token, { runId: 'x', score: -5 })).status, 400);
  ok('moedas por partida são idempotentes e a pontuação é limitada');

  // Loja
  r = await call('POST', '/shop/purchase', a.token, { itemId: 'neon' });
  assert.equal(r.status, 402);
  assert.equal(r.json.error, 'insufficient_funds');
  assert.equal((await call('GET', '/me', a.token)).json.coins, 70);
  ok('compra sem saldo é recusada e não debita');

  assert.equal((await call('POST', '/boards/equip', a.token, { boardId: 'neon' })).status, 403);
  ok('tabuleiro pago não pode ser equipado sem comprar');

  r = await call('POST', '/shop/iap-simulated', a.token, { sku: 'coins_500' });
  assert.equal(r.json.coins, 570);
  r = await call('POST', '/shop/purchase', a.token, { itemId: 'boost_x2', qty: 3 });
  assert.equal(r.json.coins, 120);
  assert.equal(r.json.inventory.boost_x2, 3);
  ok('pacote de moedas (simulado) e compra de consumível em lote');

  r = await call('POST', '/shop/iap-simulated', a.token, { sku: 'neon' });
  assert.ok(r.json.boards.includes('neon'));
  assert.equal(r.json.coins, 120);
  assert.equal((await call('POST', '/shop/purchase', a.token, { itemId: 'neon' })).json.error, 'already_owned');
  r = await call('POST', '/boards/equip', a.token, { boardId: 'neon' });
  assert.equal(r.json.equipped, 'neon');
  ok('desbloqueio via compra simulada, sem recompra, e equipar');

  r = await call('POST', '/inventory/consume', a.token, { itemId: 'boost_x2' });
  assert.equal(r.json.inventory.boost_x2, 2);
  assert.equal((await call('POST', '/inventory/consume', a.token, { itemId: 'shield' })).status, 409);
  ok('consumir item (e falha se não tiver)');

  // Compras concorrentes não podem gastar o mesmo saldo duas vezes
  const c = (await call('POST', '/auth/guest', undefined, { name: 'Cris' })).json;
  await call('POST', '/shop/iap-simulated', c.token, { sku: 'coins_500' });
  const results = await Promise.all(
    Array.from({ length: 5 }, () => call('POST', '/shop/purchase', c.token, { itemId: 'shield' })),
  );
  const wins = results.filter((x) => x.status === 200).length;
  const finalCoins = (await call('GET', '/me', c.token)).json.coins;
  assert.equal(wins, 1, `esperava 1 compra de escudo (300), houve ${wins}`);
  assert.equal(finalCoins, 200);
  ok('compras concorrentes não gastam saldo duas vezes');

  // Amigos
  assert.equal((await call('POST', '/friends', a.token, { code: a.profile.userId })).json.error, 'self');
  assert.equal((await call('POST', '/friends', a.token, { code: 'ZZZZZZZZ' })).status, 404);
  assert.equal((await call('POST', '/friends', a.token, { code: 'abc' })).status, 400);
  r = await call('POST', '/friends', a.token, { code: b.profile.userId.toLowerCase() });
  assert.equal(r.status, 201);
  await call('POST', '/friends', a.token, { code: b.profile.userId });
  const fa = (await call('GET', '/friends', a.token)).json as unknown as Json[];
  const fb = (await call('GET', '/friends', b.token)).json as unknown as Json[];
  assert.equal(fa.length, 1);
  assert.equal(fa[0].name, 'Beto');
  assert.equal(fa[0].online, false);
  assert.equal(fb[0].name, 'Anascript');
  ok('adicionar amigo (mútuo, sem duplicar, valida código)');

  await call('POST', '/presence', b.token, { score: 321 });
  const live = (await call('GET', '/friends', a.token)).json as unknown as Json[];
  assert.equal(live[0].online, true);
  assert.equal(live[0].score, 321);
  ok('presença/pontuação ao vivo do amigo');

  const del = (await call('DELETE', `/friends/${b.profile.userId}`, a.token)).json as unknown as Json[];
  assert.equal(del.length, 0);
  assert.equal(((await call('GET', '/friends', b.token)).json as unknown as Json[]).length, 0);
  ok('remover amigo (dos dois lados)');

  console.log(`\n${passed} grupos de testes passaram.`);
} catch (e) {
  console.error('\nFALHOU:', e);
  process.exitCode = 1;
} finally {
  server.close();
}
