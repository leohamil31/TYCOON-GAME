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
if (pa.skin !== 'skin_classic' || pa.wins !== 0) throw new Error('colunas novas ausentes — rode o schema.sql de novo: ' + JSON.stringify(pa));
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

// Loja expandida: pacote, skin e efeito
await must('simulated_iap coins_4000', B.rpc('simulated_iap', { p_sku: 'coins_4000' }));
const war = await must('purchase pack_war', B.rpc('purchase', { p_item: 'pack_war' }));
if (war.inventory.garbage !== 5 || war.inventory.freeze !== 3 || war.inventory.rubble !== 3) throw new Error('pacote errado: ' + JSON.stringify(war.inventory));
const lock = await B.rpc('equip_board', { p_board: 'skin_neon' });
if (!lock.error?.message.startsWith('not_owned|')) throw new Error('skin bloqueada deveria falhar');
ok('skin bloqueada não equipa');
await must('purchase skin_pixel', B.rpc('purchase', { p_item: 'skin_pixel' }));
const eq = await must('equip skin_pixel', B.rpc('equip_board', { p_board: 'skin_pixel' }));
if (eq.skin !== 'skin_pixel') throw new Error('skin não equipou');
const fxp = await must('equip fx_classic (grátis)', B.rpc('equip_board', { p_board: 'fx_classic' }));
if (fxp.effect !== 'fx_classic') throw new Error('efeito não equipou');

// Batalha + ranking
const mid = 'battle-smoke-' + Date.now();
const bt = await must('report_battle (vitória)', B.rpc('report_battle', { p_match_id: mid, p_score: 600, p_won: true }));
const bt2 = await must('report_battle repetido', B.rpc('report_battle', { p_match_id: mid, p_score: 600, p_won: true }));
if (bt.wins !== 1 || bt2.wins !== 1 || bt2.battles !== 1) throw new Error('vitória contada errado: ' + JSON.stringify(bt2));
const glob = await must('leaderboard_global', B.rpc('leaderboard_global'));
if (!glob.some((r) => r.me && r.best === 600)) throw new Error('você não aparece no ranking global');
await must('add_friend de novo', A.rpc('add_friend', { p_code: pb.userId }));
const lf = await must('leaderboard_friends', A.rpc('leaderboard_friends'));
if (lf.length !== 2 || lf[0].name !== 'Teste B') throw new Error('ranking de amigos errado: ' + JSON.stringify(lf));

// Missões, recompensa diária, níveis e baús
const ds = await must('daily_state', B.rpc('daily_state'));
if (ds.missions.length !== 3 || !ds.canClaimDaily) throw new Error('estado diário errado: ' + JSON.stringify(ds));
const cd = await must('claim_daily', B.rpc('claim_daily'));
if (cd.streak !== 1 || cd.coins !== 30) throw new Error('recompensa diária errada: ' + JSON.stringify(cd));
const cd2 = await B.rpc('claim_daily');
if (!cd2.error?.message.startsWith('forbidden|')) throw new Error('recompensa diária repetida deveria falhar');
ok('recompensa diária só uma vez por dia');
const ev = await must('mission_event', B.rpc('mission_event', { p_events: { lines: 100, combos: 100, bombs: 100, attacks: 100 } }));
const done = ev.missions.find((m) => m.progress >= m.target && !m.claimed);
if (done) {
  const cl = await must(`claim_mission ${done.id}`, B.rpc('claim_mission', { p_mission: done.id }));
  if (!cl.missions.find((m) => m.id === done.id).claimed) throw new Error('missão não marcou como resgatada');
  const again = await B.rpc('claim_mission', { p_mission: done.id });
  if (!again.error?.message.startsWith('already_owned|')) throw new Error('missão resgatada duas vezes');
  ok('missão não pode ser resgatada duas vezes');
} else ok('(nenhuma missão de evento hoje para resgatar)');
const noChest = await A.rpc('open_chest');
if (!noChest.error?.message.startsWith('not_owned|')) throw new Error('baú sem ter deveria falhar');
ok('baú bloqueado sem nível');
const lvl = await must('report_run 3000 (sobe de nível)', A.rpc('report_run', { p_run_id: 'smoke-lvl-' + Date.now(), p_score: 3000 }));
if (lvl.level < 2 || lvl.chests < 1) throw new Error('não subiu de nível: ' + JSON.stringify(lvl));
const chest = await must('open_chest', A.rpc('open_chest'));
if (!['coins', 'items', 'cosmetic'].includes(chest.reward.kind) || chest.profile.chests !== lvl.chests - 1) throw new Error('baú errado: ' + JSON.stringify(chest));
ok(`baú deu: ${JSON.stringify(chest.reward)}`);

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
