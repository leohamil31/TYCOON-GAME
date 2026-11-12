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

-- ---------------------------------------------------------------- RLS: leitura mínima, nenhuma escrita direta
alter table public.shop_items enable row level security;
alter table public.coin_packs enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.runs enable row level security;

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

create or replace function public._json(p public.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'userId', p.code, 'name', p.name, 'coins', p.coins, 'best', p.best,
    'inventory', p.inventory, 'boards', to_jsonb(p.boards), 'equipped', p.equipped,
    'skin', p.skin, 'effect', p.effect, 'wins', p.wins, 'battles', p.battles)
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
  update profiles set coins = coins + delta, best = greatest(best, run_best) where id = p.id returning * into p;
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

-- ---------------------------------------------------------------- permissões
revoke all on all functions in schema public from public, anon;
grant execute on function
  public.init_profile(text), public.set_name(text), public.report_run(text, int), public.purchase(text, int),
  public.simulated_iap(text), public.equip_board(text), public.consume(text), public.heartbeat(int),
  public.list_friends(), public.add_friend(text), public.remove_friend(text),
  public.report_battle(text, int, boolean), public.leaderboard_global(), public.leaderboard_friends()
to authenticated;
