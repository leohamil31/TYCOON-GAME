-- =====================================================================
-- Tycoon Game — banco de dados no Supabase
-- Cole TODO este arquivo em: Supabase > SQL Editor > New query > Run.
-- Pode rodar de novo quando quiser (é idempotente).
--
-- Segurança: o app usa só a chave PUBLICÁVEL. Ninguém altera moedas,
-- itens ou amigos direto nas tabelas (RLS bloqueia); tudo passa pelas
-- funções abaixo, que validam preços e saldos no servidor.
-- =====================================================================

-- ---------------------------------------------------------------- catálogo (espelho de src/shop/catalog.ts)
-- kind: board (tema) | skin (peças) | fx (efeito de limpeza) | consumable | bundle (pacote)
create table if not exists public.shop_items (
  id text primary key,
  kind text not null,
  price int not null check (price >= 0),
  real_cents int,
  grants jsonb
);
alter table public.shop_items add column if not exists grants jsonb;
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in ('board', 'skin', 'fx', 'consumable', 'bundle'));

insert into public.shop_items (id, kind, price, real_cents, grants) values
  ('classic',      'board',      0,    null, null),
  ('neon',         'board',      600,  490,  null),
  ('space',        'board',      1200, 790,  null),
  ('cyber',        'board',      2000, 990,  null),
  ('aurora',       'board',      1500, 790,  null),
  ('abyss',        'board',      1800, 890,  null),
  ('ember',        'board',      2200, 990,  null),
  ('skin_classic', 'skin',       0,    null, null),
  ('skin_neon',    'skin',       800,  null, null),
  ('skin_glass',   'skin',       900,  null, null),
  ('skin_pixel',   'skin',       700,  null, null),
  ('fx_classic',   'fx',         0,    null, null),
  ('fx_stars',     'fx',         700,  null, null),
  ('fx_pixel',     'fx',         600,  null, null),
  ('fx_bubbles',   'fx',         800,  null, null),
  ('boost_x2',     'consumable', 150,  null, null),
  ('shield',       'consumable', 300,  null, null),
  ('bomb',         'consumable', 200,  null, null),
  ('reroll',       'consumable', 120,  null, null),
  ('undo',         'consumable', 100,  null, null),
  ('garbage',      'consumable', 180,  null, null),
  ('freeze',       'consumable', 250,  null, null),
  ('rubble',       'consumable', 300,  null, null),
  ('pack_bombs',   'bundle',     800,  null, '{"bomb":5}'),
  ('pack_war',     'bundle',     1300, null, '{"garbage":3,"freeze":2,"rubble":2}')
on conflict (id) do update set kind = excluded.kind, price = excluded.price, real_cents = excluded.real_cents, grants = excluded.grants;

create table if not exists public.coin_packs (
  id text primary key,
  coins int not null check (coins > 0)
);
insert into public.coin_packs (id, coins) values
  ('coins_500', 500), ('coins_1500', 1500), ('coins_4000', 4000)
on conflict (id) do update set coins = excluded.coins;

-- ---------------------------------------------------------------- jogadores
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  name text not null default 'Jogador',
  coins int not null default 100 check (coins >= 0),
  best int not null default 0,
  inventory jsonb not null default '{"boost_x2":1,"bomb":1,"reroll":1,"undo":1,"shield":1}'::jsonb,
  boards text[] not null default array['classic'],
  equipped text not null default 'classic',
  live_score int not null default 0,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Colunas novas (cosméticos equipados e estatísticas de batalha).
alter table public.profiles add column if not exists skin text not null default 'skin_classic';
alter table public.profiles add column if not exists effect text not null default 'fx_classic';
alter table public.profiles add column if not exists wins int not null default 0;
alter table public.profiles add column if not exists battles int not null default 0;
alter table public.profiles alter column inventory set default
  '{"boost_x2":1,"bomb":1,"reroll":1,"undo":1,"shield":1,"garbage":2,"freeze":1,"rubble":1}'::jsonb;
create index if not exists profiles_best_idx on public.profiles (best desc);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.runs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  run_id text not null,
  score int not null,
  paid int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

-- ---------------------------------------------------------------- progressão: níveis, baús, sequência diária, missões
alter table public.profiles add column if not exists xp int not null default 0;
alter table public.profiles add column if not exists level int not null default 1;
alter table public.profiles add column if not exists chests int not null default 0;
alter table public.profiles add column if not exists streak int not null default 0;
alter table public.profiles add column if not exists last_daily date;

-- metric: games | score (melhor partida do dia) | lines | combos | bombs | attacks | battles | wins
create table if not exists public.missions (
  id text primary key,
  title text not null,
  icon text not null,
  metric text not null,
  target int not null check (target > 0),
  reward int not null,
  xp int not null,
  battle boolean not null default false
);
insert into public.missions (id, title, icon, metric, target, reward, xp, battle) values
  ('play_3',     'Jogue 3 partidas',               '🎮', 'games',   3,    40, 30, false),
  ('play_6',     'Jogue 6 partidas',               '🕹️', 'games',   6,    70, 50, false),
  ('lines_15',   'Limpe 15 linhas',                '🧹', 'lines',   15,   50, 40, false),
  ('lines_40',   'Limpe 40 linhas',                '🧱', 'lines',   40,   90, 70, false),
  ('combo_3',    'Faça 3 combos',                  '🔥', 'combos',  3,    50, 40, false),
  ('combo_8',    'Faça 8 combos',                  '💥', 'combos',  8,    90, 70, false),
  ('score_800',  'Faça 800 pontos numa partida',   '⭐', 'score',   800,  50, 40, false),
  ('score_2000', 'Faça 2000 pontos numa partida',  '🌟', 'score',   2000, 100, 80, false),
  ('bomb_2',     'Use 2 bombas',                   '💣', 'bombs',   2,    40, 30, false),
  ('battle_2',   'Jogue 2 batalhas',               '⚔️', 'battles', 2,    70, 60, true),
  ('win_1',      'Vença 1 batalha',                '🏆', 'wins',    1,    80, 70, true),
  ('attack_5',   'Envie 5 ataques numa batalha',   '☄️', 'attacks', 5,    60, 50, true)
on conflict (id) do update set title = excluded.title, icon = excluded.icon, metric = excluded.metric,
  target = excluded.target, reward = excluded.reward, xp = excluded.xp, battle = excluded.battle;

create table if not exists public.mission_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  mission_id text not null references public.missions (id) on delete cascade,
  progress int not null default 0,
  claimed boolean not null default false,
  primary key (user_id, day, mission_id)
);

-- ---------------------------------------------------------------- RLS: leitura mínima, nenhuma escrita direta
alter table public.shop_items enable row level security;
alter table public.coin_packs enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.runs enable row level security;
alter table public.missions enable row level security;
alter table public.mission_progress enable row level security;

drop policy if exists "catalogo publico" on public.shop_items;
create policy "catalogo publico" on public.shop_items for select using (true);
drop policy if exists "pacotes publicos" on public.coin_packs;
create policy "pacotes publicos" on public.coin_packs for select using (true);
drop policy if exists "meu perfil" on public.profiles;
create policy "meu perfil" on public.profiles for select using (id = auth.uid());
drop policy if exists "minhas amizades" on public.friendships;
create policy "minhas amizades" on public.friendships for select using (user_id = auth.uid());

-- ---------------------------------------------------------------- helpers
-- Erros no formato 'codigo|mensagem' (o app separa os dois).
create or replace function public._fail(p_code text, p_msg text) returns void
language plpgsql as $$ begin raise exception '%|%', p_code, p_msg using errcode = 'P0001'; end $$;

create or replace function public._me() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then perform _fail('unauthorized', 'Sessão expirada. Abra o jogo de novo.'); end if;
  select * into p from profiles where id = auth.uid() for update;
  if not found then perform _fail('unauthorized', 'Perfil não encontrado.'); end if;
  return p;
end $$;

-- Dia do jogo no horário de Brasília (missões e recompensa diária viram à meia-noite daqui).
create or replace function public._today() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- XP para passar do nível L para L+1: 100, 150, 200, ...
create or replace function public._xp_need(p_level int) returns int
language sql immutable as $$ select 100 + 50 * (greatest(p_level, 1) - 1) $$;

-- [nível, xp dentro do nível, xp para o próximo] a partir do XP total.
create or replace function public._level_progress(p_xp int) returns int[]
language plpgsql immutable as $$
declare lvl int := 1; rest int := greatest(coalesce(p_xp, 0), 0);
begin
  while rest >= _xp_need(lvl) and lvl < 200 loop
    rest := rest - _xp_need(lvl);
    lvl := lvl + 1;
  end loop;
  return array[lvl, rest, _xp_need(lvl)];
end $$;

create or replace function public._json(p public.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'userId', p.code, 'name', p.name, 'coins', p.coins, 'best', p.best,
    'inventory', p.inventory, 'boards', to_jsonb(p.boards), 'equipped', p.equipped,
    'skin', p.skin, 'effect', p.effect, 'wins', p.wins, 'battles', p.battles,
    'xp', p.xp, 'level', p.level, 'xpInto', (_level_progress(p.xp))[2], 'xpNeed', (_level_progress(p.xp))[3],
    'chests', p.chests, 'streak', p.streak)
$$;

create or replace function public._clean_name(p_name text) returns text
language sql immutable as $$
  select coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 16), ''), 'Jogador')
$$;

create or replace function public._new_code() returns text
language plpgsql security definer set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(a, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from profiles where code = c);
  end loop;
  return c;
end $$;

-- Soma XP; cada nível novo dá 1 baú.
create or replace function public._add_xp(p_id uuid, p_n int) returns void
language plpgsql security definer set search_path = public as $$
declare old_level int; new_xp int; new_level int;
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  update profiles set xp = xp + p_n where id = p_id returning xp, level into new_xp, old_level;
  new_level := (_level_progress(new_xp))[1];
  if new_level > old_level then
    update profiles set level = new_level, chests = chests + (new_level - old_level) where id = p_id;
  end if;
end $$;

-- Sorteia as 3 missões do dia do jogador (2 do modo solo + 1 qualquer) — sempre as mesmas no mesmo dia.
create or replace function public._ensure_missions(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d date := _today();
begin
  if exists (select 1 from mission_progress where user_id = p_id and day = d) then return; end if;
  insert into mission_progress (user_id, day, mission_id)
  select p_id, d, id from (
    (select id from missions where not battle order by md5(p_id::text || d::text || id) limit 2)
  ) a
  on conflict do nothing;
  insert into mission_progress (user_id, day, mission_id)
  select p_id, d, id from missions
  where id not in (select mission_id from mission_progress where user_id = p_id and day = d)
  order by md5(d::text || p_id::text || id) limit 1
  on conflict do nothing;
end $$;

-- Avança as missões de hoje que medem `p_metric` (score = guarda o melhor valor).
create or replace function public._bump(p_id uuid, p_metric text, p_n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  perform _ensure_missions(p_id);
  update mission_progress mp
     set progress = least(m.target, case when p_metric = 'score' then greatest(mp.progress, p_n) else mp.progress + p_n end)
    from missions m
   where m.id = mp.mission_id and m.metric = p_metric and mp.user_id = p_id and mp.day = _today() and not mp.claimed;
end $$;

-- ---------------------------------------------------------------- API (chamadas pelo app via rpc)
create or replace function public.init_profile(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then perform _fail('unauthorized', 'Sessão inválida.'); end if;
  insert into profiles (id, code, name) values (auth.uid(), _new_code(), _clean_name(p_name))
  on conflict (id) do nothing;
  update profiles set last_seen = now() where id = auth.uid() returning * into p;
  return _json(p);
end $$;

create or replace function public.set_name(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me();
begin
  update profiles set name = _clean_name(p_name) where id = p.id returning * into p;
  return _json(p);
end $$;

create or replace function public.report_run(p_run_id text, p_score int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := _me();
  sc int := least(greatest(coalesce(p_score, 0), 0), 200000);
  prev public.runs;
  run_best int;
  delta int;
begin
  if p_run_id is null or length(p_run_id) > 80 then perform _fail('invalid', 'Partida inválida.'); end if;
  select * into prev from runs where user_id = p.id and run_id = p_run_id;
  if not found then
    -- anti-abuso simples: no máximo 6 partidas novas por minuto
    if (select count(*) from runs where user_id = p.id and created_at > now() - interval '1 minute') >= 6 then
      perform _fail('forbidden', 'Muitas partidas em pouco tempo.');
    end if;
  end if;
  run_best := greatest(coalesce(prev.score, 0), sc);
  delta := greatest(0, floor(run_best / 20.0)::int - coalesce(prev.paid, 0));
  insert into runs (user_id, run_id, score, paid) values (p.id, p_run_id, run_best, coalesce(prev.paid, 0) + delta)
  on conflict (user_id, run_id) do update set score = excluded.score, paid = excluded.paid;
  update profiles set coins = coins + delta, best = greatest(best, run_best) where id = p.id;
  -- progressão: 1 XP a cada 10 pontos; missões de partidas e de pontuação
  perform _add_xp(p.id, delta * 2);
  if prev.run_id is null and run_best > 0 then perform _bump(p.id, 'games', 1); end if;
  perform _bump(p.id, 'score', run_best);
  select * into p from profiles where id = p.id;
  return _json(p);
end $$;

create or replace function public.purchase(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := _me();
  it public.shop_items;
  n int;
begin
  select * into it from shop_items where id = p_item;
  if not found or it.price <= 0 then perform _fail('not_found', 'Item não está à venda.'); end if;
  n := case when it.kind = 'consumable' then least(10, greatest(1, coalesce(p_qty, 1))) else 1 end;
  if it.kind in ('board', 'skin', 'fx') and it.id = any (p.boards) then perform _fail('already_owned', 'Você já possui este item.'); end if;
  if p.coins < it.price * n then perform _fail('insufficient_funds', 'Moedas insuficientes.'); end if;
  if it.kind in ('board', 'skin', 'fx') then
    update profiles set coins = coins - it.price, boards = array_append(boards, it.id) where id = p.id returning * into p;
  elsif it.kind = 'bundle' then
    -- Pacote: soma cada item do "grants" ao inventário.
    update profiles set coins = coins - it.price,
      inventory = inventory || (
        select coalesce(jsonb_object_agg(g.key, coalesce((inventory ->> g.key)::int, 0) + g.value::int), '{}'::jsonb)
        from jsonb_each_text(it.grants) g)
    where id = p.id returning * into p;
  else
    update profiles set coins = coins - it.price * n,
      inventory = jsonb_set(inventory, array[it.id], to_jsonb(coalesce((inventory ->> it.id)::int, 0) + n))
    where id = p.id returning * into p;
  end if;
  return _json(p);
end $$;

-- Compra com dinheiro real SIMULADA (demonstração, sem cobrança).
create or replace function public.simulated_iap(p_sku text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := _me();
  pk public.coin_packs;
  it public.shop_items;
begin
  select * into pk from coin_packs where id = p_sku;
  if found then
    update profiles set coins = coins + pk.coins where id = p.id returning * into p;
    return _json(p);
  end if;
  select * into it from shop_items where id = p_sku and kind in ('board', 'skin', 'fx') and real_cents is not null;
  if not found then perform _fail('not_found', 'Produto não encontrado.'); end if;
  if it.id = any (p.boards) then perform _fail('already_owned', 'Você já possui este item.'); end if;
  update profiles set boards = array_append(boards, it.id) where id = p.id returning * into p;
  return _json(p);
end $$;

-- Equipa qualquer cosmético (tema, skin das peças ou efeito). Itens grátis já vêm liberados.
create or replace function public.equip_board(p_board text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); it public.shop_items;
begin
  select * into it from shop_items where id = p_board and kind in ('board', 'skin', 'fx');
  if not found then perform _fail('not_found', 'Item inválido.'); end if;
  if it.price > 0 and not (p_board = any (p.boards)) then perform _fail('not_owned', 'Bloqueado. Compre na loja para usar.'); end if;
  if it.kind = 'skin' then
    update profiles set skin = p_board where id = p.id returning * into p;
  elsif it.kind = 'fx' then
    update profiles set effect = p_board where id = p.id returning * into p;
  else
    update profiles set equipped = p_board where id = p.id returning * into p;
  end if;
  return _json(p);
end $$;

-- Resultado de batalha: moedas (mesma regra do solo) + vitória/partida no ranking. Uma vez por partida.
create or replace function public.report_battle(p_match_id text, p_score int, p_won boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); seen boolean;
begin
  if p_match_id is null or length(p_match_id) > 80 then perform _fail('invalid', 'Partida inválida.'); end if;
  seen := exists (select 1 from runs where user_id = p.id and run_id = p_match_id);
  perform report_run(p_match_id, p_score);
  if not seen then
    update profiles set battles = battles + 1, wins = wins + case when p_won then 1 else 0 end where id = p.id;
    perform _add_xp(p.id, case when p_won then 40 else 15 end);
    perform _bump(p.id, 'battles', 1);
    if p_won then perform _bump(p.id, 'wins', 1); end if;
  end if;
  select * into p from profiles where id = p.id;
  return _json(p);
end $$;

-- ---------------------------------------------------------------- rankings
-- Top 50 global por recorde (+ a sua posição, se você estiver fora do top).
create or replace function public.leaderboard_global() returns jsonb
language sql stable security definer set search_path = public as $$
  with ranked as (
    select id, name, best, wins, rank() over (order by best desc, wins desc, created_at) as pos
    from profiles where best > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'rank', pos, 'name', name, 'best', best, 'wins', wins, 'me', id = auth.uid()) order by pos), '[]'::jsonb)
  from ranked where pos <= 50 or id = auth.uid()
$$;

-- Você + seus amigos, por recorde.
create or replace function public.leaderboard_friends() returns jsonb
language sql stable security definer set search_path = public as $$
  with people as (
    select p.id, p.code, p.name, p.best, p.wins from profiles p where p.id = auth.uid()
    union
    select f.id, f.code, f.name, f.best, f.wins from friendships s join profiles f on f.id = s.friend_id where s.user_id = auth.uid()
  ), ranked as (
    select *, rank() over (order by best desc, wins desc) as pos from people
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'rank', pos, 'name', name, 'best', best, 'wins', wins, 'code', code, 'me', id = auth.uid()) order by pos), '[]'::jsonb)
  from ranked
$$;

create or replace function public.consume(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); q int;
begin
  q := coalesce((p.inventory ->> p_item)::int, 0);
  if q <= 0 then perform _fail('not_owned', 'Você não tem este item.'); end if;
  update profiles set inventory = case when q = 1 then inventory - p_item else jsonb_set(inventory, array[p_item], to_jsonb(q - 1)) end
  where id = p.id returning * into p;
  return _json(p);
end $$;

create or replace function public.heartbeat(p_score int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set live_score = least(greatest(coalesce(p_score, 0), 0), 200000), last_seen = now() where id = auth.uid();
end $$;

create or replace function public.list_friends() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x ->> 'best')::int desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', f.code, 'name', f.name,
      'online', f.last_seen > now() - interval '30 seconds',
      'score', case when f.last_seen > now() - interval '30 seconds' then f.live_score else 0 end,
      'best', f.best) as x
    from friendships s join profiles f on f.id = s.friend_id
    where s.user_id = auth.uid()
  ) t
$$;

create or replace function public.add_friend(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); other uuid;
begin
  select id into other from profiles where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if other is null then perform _fail('not_found', 'Nenhum jogador com esse código.'); end if;
  if other = p.id then perform _fail('self', 'Esse é o seu próprio código.'); end if;
  if (select count(*) from friendships where user_id = p.id) >= 200 then perform _fail('forbidden', 'Limite de amigos atingido.'); end if;
  insert into friendships (user_id, friend_id) values (p.id, other), (other, p.id) on conflict do nothing;
  return list_friends();
end $$;

create or replace function public.remove_friend(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); other uuid;
begin
  select id into other from profiles where code = upper(p_code);
  if other is not null then
    delete from friendships where (user_id = p.id and friend_id = other) or (user_id = other and friend_id = p.id);
  end if;
  return list_friends();
end $$;

-- ---------------------------------------------------------------- missões, recompensa diária e baús
-- Estado do dia: missões, sequência e recompensa diária.
create or replace function public.daily_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); d date := _today(); nxt int;
begin
  perform _ensure_missions(p.id);
  nxt := case when p.last_daily = d - 1 then p.streak + 1 when p.last_daily = d then p.streak else 1 end;
  return jsonb_build_object(
    'day', d,
    'streak', case when p.last_daily >= d - 1 then p.streak else 0 end,
    'canClaimDaily', p.last_daily is distinct from d,
    'dailyCoins', 20 + 10 * least(nxt, 7),
    'dailyChest', nxt % 7 = 0,
    'nextStreak', nxt,
    'missions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'icon', m.icon, 'target', m.target, 'progress', least(mp.progress, m.target),
        'reward', m.reward, 'xp', m.xp, 'claimed', mp.claimed, 'battle', m.battle) order by m.battle, m.reward), '[]'::jsonb)
      from mission_progress mp join missions m on m.id = mp.mission_id
      where mp.user_id = p.id and mp.day = d),
    'profile', _json(p));
end $$;

-- Eventos da partida que só o app sabe (linhas, combos, bombas, ataques). Valores limitados por chamada.
create or replace function public.mission_event(p_events jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); k text;
begin
  foreach k in array array['lines', 'combos', 'bombs', 'attacks'] loop
    perform _bump(p.id, k, least(greatest(coalesce((p_events ->> k)::int, 0), 0), 100));
  end loop;
  return daily_state();
end $$;

-- Recompensa diária: 30, 40, ... 90 moedas (sequência de até 7 dias) e 1 baú a cada 7 dias seguidos.
-- Faltar um dia só recomeça a sequência; nada é tirado do jogador.
create or replace function public.claim_daily() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); d date := _today(); nxt int; c int; chest boolean;
begin
  if p.last_daily = d then perform _fail('forbidden', 'Você já pegou a recompensa de hoje. Volte amanhã!'); end if;
  nxt := case when p.last_daily = d - 1 then p.streak + 1 else 1 end;
  c := 20 + 10 * least(nxt, 7);
  chest := nxt % 7 = 0;
  update profiles set streak = nxt, last_daily = d, coins = coins + c, chests = chests + case when chest then 1 else 0 end
   where id = p.id returning * into p;
  perform _add_xp(p.id, 10);
  select * into p from profiles where id = p.id;
  return jsonb_build_object('coins', c, 'chest', chest, 'streak', nxt, 'profile', _json(p));
end $$;

create or replace function public.claim_mission(p_mission text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles := _me(); m public.missions; mp public.mission_progress;
begin
  select * into mp from mission_progress where user_id = p.id and day = _today() and mission_id = p_mission for update;
  if not found then perform _fail('not_found', 'Missão não encontrada.'); end if;
  select * into m from missions where id = p_mission;
  if mp.claimed then perform _fail('already_owned', 'Recompensa já resgatada.'); end if;
  if mp.progress < m.target then perform _fail('forbidden', 'Missão ainda não concluída.'); end if;
  update mission_progress set claimed = true where user_id = p.id and day = mp.day and mission_id = p_mission;
  update profiles set coins = coins + m.reward where id = p.id;
  perform _add_xp(p.id, m.xp);
  return daily_state();
end $$;

-- Abre um baú: 60% moedas, 30% itens, 10% cosmético que você ainda não tem (sem dinheiro real envolvido).
create or replace function public.open_chest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles := _me();
  r float := random();
  reward jsonb;
  amount int;
  cos text;
  a text;
  b text;
begin
  if p.chests <= 0 then perform _fail('not_owned', 'Você não tem baús. Suba de nível para ganhar!'); end if;
  update profiles set chests = chests - 1 where id = p.id;
  if r >= 0.9 then
    select id into cos from shop_items
     where kind in ('skin', 'fx', 'board') and price between 1 and 1500 and not (id = any (p.boards))
     order by random() limit 1;
  end if;
  if cos is not null then
    update profiles set boards = array_append(boards, cos) where id = p.id;
    reward := jsonb_build_object('kind', 'cosmetic', 'id', cos);
  elsif r >= 0.6 then
    select id into a from shop_items where kind = 'consumable' order by random() limit 1;
    select id into b from shop_items where kind = 'consumable' order by random() limit 1;
    update profiles set inventory = jsonb_set(inventory, array[a], to_jsonb(coalesce((inventory ->> a)::int, 0) + 1)) where id = p.id;
    update profiles set inventory = jsonb_set(inventory, array[b], to_jsonb(coalesce((inventory ->> b)::int, 0) + 1)) where id = p.id;
    reward := jsonb_build_object('kind', 'items', 'items', case when a = b then jsonb_build_object(a, 2) else jsonb_build_object(a, 1, b, 1) end);
  else
    amount := case when cos is null and r >= 0.9 then 400 else 60 + floor(random() * 141)::int end;
    update profiles set coins = coins + amount where id = p.id;
    reward := jsonb_build_object('kind', 'coins', 'amount', amount);
  end if;
  select * into p from profiles where id = p.id;
  return jsonb_build_object('reward', reward, 'profile', _json(p));
end $$;

-- ---------------------------------------------------------------- permissões
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.init_profile(text), public.set_name(text), public.report_run(text, int), public.purchase(text, int),
  public.simulated_iap(text), public.equip_board(text), public.consume(text), public.heartbeat(int),
  public.list_friends(), public.add_friend(text), public.remove_friend(text),
  public.report_battle(text, int, boolean), public.leaderboard_global(), public.leaderboard_friends(),
  public.daily_state(), public.mission_event(jsonb), public.claim_daily(), public.claim_mission(text), public.open_chest()
to authenticated;
