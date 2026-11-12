// Teste de ponta a ponta do servidor Supabase: dois jogadores anônimos, amizade, loja e sala em tempo real.
// Uso: node scripts/supabase-smoke.mjs   (lê URL e chave publicável de src/services/supabase.ts)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const src = readFileSync(new URL('../src/services/supabase.ts', import.meta.url), 'utf8');
const url = src.match(/SUPABASE_URL = '([^']*)'/)?.[1];
const key = src.match(/SUPABASE_KEY = '([^']*)'/)?.[1];
if (!url) {
  console.log('SUPABASE_URL vazio: nada a testar (modo demonstração).');
  process.exit(0);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const A = createClient(url, key, opts);
const B = createClient(url, key, opts);
const ok = (m) => console.log('✔', m);
const must = async (label, p) => {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  ok(label);
  return data;
};

for (const [n, c] of [['A', A], ['B', B]]) {
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`login anônimo ${n}: ${error.message} (ative "Allow anonymous sign-ins")`);
  ok(`login anônimo ${n}`);
}
const pa = await must('init_profile A', A.rpc('init_profile', { p_name: 'Teste A' }));
const pb = await must('init_profile B', B.rpc('init_profile', { p_name: 'Teste B' }));
if (pa.coins !== 100 || pa.inventory.bomb !== 1) throw new Error('kit inicial errado: ' + JSON.stringify(pa));
const fr = await must('add_friend', A.rpc('add_friend', { p_code: pb.userId }));
if (fr.length !== 1 || fr[0].id !== pb.userId) throw new Error('amizade não apareceu');
const fb = await must('list_friends B', B.rpc('list_friends'));
if (fb[0]?.id !== pa.userId) throw new Error('amizade não é mútua');
const after = await must('purchase undo', A.rpc('purchase', { p_item: 'undo', p_qty: 1 }));
if (after.coins !== 0 || after.inventory.undo !== 2) throw new Error('compra errada: ' + JSON.stringify(after));
const broke = await A.rpc('purchase', { p_item: 'bomb', p_qty: 1 });
if (!broke.error?.message.startsWith('insufficient_funds|')) throw new Error('deveria faltar moeda');
ok('saldo insuficiente bloqueado');
await must('consume bomb', A.rpc('consume', { p_item: 'bomb' }));
const run = await must('report_run', A.rpc('report_run', { p_run_id: 'smoke-' + Date.now(), p_score: 400 }));
if (run.coins !== 20) throw new Error('moedas da partida erradas: ' + run.coins);
const direct = await A.from('profiles').update({ coins: 999999 }).eq('code', pa.userId).select();
if ((direct.data ?? []).length > 0) throw new Error('RLS falhou: perfil alterado direto!');
ok('RLS bloqueia edição direta');

// Sala em tempo real
const room = 'SMK' + Math.random().toString(36).slice(2, 4).toUpperCase();
const got = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('broadcast não chegou')), 15000);
  const cb = B.channel(`tycoon-room-${room}`, { config: { broadcast: { self: false } } });
  cb.on('broadcast', { event: 'm' }, ({ payload }) => {
    clearTimeout(t);
    resolve(payload);
  });
  cb.subscribe(async (s) => {
    if (s !== 'SUBSCRIBED') return;
    const ca = A.channel(`tycoon-room-${room}`, { config: { broadcast: { self: false } } });
    ca.subscribe(async (s2) => {
      if (s2 === 'SUBSCRIBED') await ca.send({ type: 'broadcast', event: 'm', payload: { t: 'start' } });
    });
  });
});
const payload = await got;
if (payload?.t !== 'start') throw new Error('mensagem errada');
ok('sala em tempo real (broadcast)');

await must('remove_friend', A.rpc('remove_friend', { p_code: pb.userId }));
console.log('\nTudo certo! Servidor pronto para jogar com amigos.');
process.exit(0);
