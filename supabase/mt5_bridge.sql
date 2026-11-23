-- =====================================================================
-- EAG Bridge · EAG Charts ⇄ MetaTrader 5 (sin servidor propio: todo en Supabase)
--   EA en MT5  --POST /rest/v1/rpc/mt5_ea_sync (cada 1 s)-->  Supabase  <--RPC--  pestaña MT5 del panel Operar (solo admin)
-- El EA manda el estado de la cuenta y recibe las órdenes en cola. Las órdenes las crea solo un admin.
-- Correr en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mt5_config (
  id int primary key default 1 check (id = 1),
  token_hash text,
  token_at timestamptz
);
insert into public.mt5_config (id) values (1) on conflict do nothing;

create table if not exists public.mt5_accounts (
  login text primary key,
  account jsonb not null default '{}',
  positions jsonb not null default '[]',
  orders jsonb not null default '[]',
  history jsonb not null default '[]',
  today jsonb,
  symbols jsonb not null default '{}',
  last_sync timestamptz not null default now()
);

create table if not exists public.mt5_commands (
  id text primary key,
  login text not null,
  action text not null,
  params jsonb not null default '{}',
  status text not null default 'queued',      -- queued | sent | done | error | expired | unknown
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  finished_at timestamptz
);
create index if not exists mt5_commands_q on public.mt5_commands (login, status, created_at);
create index if not exists mt5_commands_t on public.mt5_commands (created_at);

-- nadie lee estas tablas directo: solo por las funciones de abajo
alter table public.mt5_config enable row level security;
alter table public.mt5_accounts enable row level security;
alter table public.mt5_commands enable row level security;
revoke all on public.mt5_config, public.mt5_accounts, public.mt5_commands from anon, authenticated;

-- ---------------------------------------------------------------------
-- token del EA (lo genera el admin desde la pestaña MT5; se guarda solo su huella)
-- ---------------------------------------------------------------------
create or replace function public.mt5_new_token() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  t := 'eag_' || encode(extensions.gen_random_bytes(24), 'hex');
  update public.mt5_config set token_hash = encode(extensions.digest(t, 'sha256'), 'hex'), token_at = now() where id = 1;
  return t;
end $$;
grant execute on function public.mt5_new_token() to authenticated;

-- ---------------------------------------------------------------------
-- EA: sincroniza y recoge órdenes. Devuelve texto: OK|ms \n CMD|id|accion|simbolo|tipo|volumen|precio|sl|tp|ticket|expira|stoplimit|comentario|E
-- ---------------------------------------------------------------------
create or replace function public.mt5_fld(v text) returns text language sql immutable as $$
  select coalesce(nullif(trim(regexp_replace(left(coalesce(v, ''), 64), '[|\r\n]', ' ', 'g')), ''), '-')
$$;

create or replace function public.mt5_ea_sync(p jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  tok text; h text; lg text; r jsonb; c record; out text; syms jsonb := '{}'; s jsonb; ids text[];
begin
  begin tok := current_setting('request.headers', true)::json ->> 'x-eag-token'; exception when others then tok := null; end;
  select token_hash into h from public.mt5_config where id = 1;
  if h is null or tok is null or encode(extensions.digest(tok, 'sha256'), 'hex') <> h then
    raise sqlstate 'PT401' using message = 'ERR|token';
  end if;
  lg := p -> 'account' ->> 'login';
  if lg is null or lg !~ '^\d{1,20}$' then raise sqlstate 'PT400' using message = 'ERR|login'; end if;

  for s in select * from jsonb_array_elements(coalesce(p -> 'symbols', '[]')) loop
    if s ->> 'symbol' is not null then syms := syms || jsonb_build_object(s ->> 'symbol', s); end if;
  end loop;

  insert into public.mt5_accounts as a (login, account, positions, orders, history, today, symbols, last_sync)
  values (lg, coalesce(p -> 'account', '{}'), coalesce(p -> 'positions', '[]'), coalesce(p -> 'orders', '[]'),
          coalesce(p -> 'history', '[]'), p -> 'today', syms, now())
  on conflict (login) do update set account = excluded.account, positions = excluded.positions, orders = excluded.orders,
    history = case when p ? 'history' then excluded.history else a.history end, today = excluded.today, symbols = a.symbols || excluded.symbols, last_sync = now();

  -- resultados de lo que el EA ejecutó
  for r in select * from jsonb_array_elements(coalesce(p -> 'results', '[]')) loop
    update public.mt5_commands set status = case when (r ->> 'ok')::boolean then 'done' else 'error' end, result = r, finished_at = now()
    where id = r ->> 'id' and status not in ('done', 'error');
  end loop;

  -- órdenes viejas: nunca se ejecuta una entrada que MT5 no recogió a tiempo
  update public.mt5_commands set status = 'expired', finished_at = now(),
    result = jsonb_build_object('ok', false, 'msg', 'Expiró: MT5 no la recogió a tiempo')
  where login = lg and status = 'queued' and created_at < now() - interval '15 seconds';
  update public.mt5_commands set status = 'unknown', finished_at = now(),
    result = jsonb_build_object('ok', false, 'msg', 'MT5 no confirmó el resultado. Revisa la terminal.')
  where login = lg and status = 'sent' and sent_at < now() - interval '30 seconds';

  out := 'OK|' || (extract(epoch from now()) * 1000)::bigint;
  select coalesce(array_agg(id), '{}') into ids from (
    select id from public.mt5_commands where login = lg and status = 'queued' order by created_at for update skip locked) q;
  update public.mt5_commands set status = 'sent', sent_at = now() where id = any(ids);
  for c in select * from public.mt5_commands where id = any(ids) order by created_at, id loop
    out := out || E'\n' || concat_ws('|', 'CMD', c.id, c.action,
      public.mt5_fld(c.params ->> 'symbol'), public.mt5_fld(c.params ->> 'otype'), public.mt5_fld(c.params ->> 'volume'),
      public.mt5_fld(c.params ->> 'price'), public.mt5_fld(c.params ->> 'sl'), public.mt5_fld(c.params ->> 'tp'),
      public.mt5_fld(c.params ->> 'ticket'), public.mt5_fld(c.params ->> 'expiration'), public.mt5_fld(c.params ->> 'stoplimit'),
      public.mt5_fld(c.params ->> 'comment'), 'E');
  end loop;

  if random() < 0.002 then delete from public.mt5_commands where created_at < now() - interval '14 days'; end if;
  return out;
end $$;
grant execute on function public.mt5_ea_sync(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Panel (solo admin)
-- ---------------------------------------------------------------------
create or replace function public.mt5_panel_poll(p_account text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lg text; st jsonb; accs jsonb; cmds jsonb; tk jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('login', login, 'name', account ->> 'name', 'server', account ->> 'server',
           'trade_mode', account ->> 'trade_mode', 'online', last_sync > now() - interval '5 seconds') order by last_sync desc), '[]')
    into accs from public.mt5_accounts;
  lg := coalesce(nullif(p_account, ''), (select login from public.mt5_accounts order by last_sync desc limit 1));
  select jsonb_build_object('login', login, 'online', last_sync > now() - interval '5 seconds',
           'lastSync', (extract(epoch from last_sync) * 1000)::bigint, 'account', account, 'positions', positions,
           'orders', orders, 'history', history, 'today', today,
           'symbols', coalesce((select jsonb_agg(v) from jsonb_each(symbols) e(k, v)), '[]'))
    into st from public.mt5_accounts where login = lg;
  select coalesce(jsonb_agg(x order by x ->> 'createdAt'), '[]') into cmds from (
    select jsonb_build_object('id', id, 'account', login, 'action', action, 'params', params, 'status', status, 'result', result,
             'createdAt', (extract(epoch from created_at) * 1000)::bigint, 'finishedAt', (extract(epoch from finished_at) * 1000)::bigint) x
    from public.mt5_commands where login = lg order by created_at desc limit 60) q;
  select jsonb_build_object('has', token_hash is not null, 'at', token_at) into tk from public.mt5_config where id = 1;
  return jsonb_build_object('accounts', accs, 'state', st, 'commands', cmds, 'token', tk, 'now', (extract(epoch from now()) * 1000)::bigint);
end $$;
grant execute on function public.mt5_panel_poll(text) to authenticated;

create or replace function public.mt5_panel_command(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  a text := p ->> 'action'; lg text := nullif(p ->> 'account', ''); prm jsonb; nid text; online boolean; n int;
  sym text; f text;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Solo el admin.'); end if;
  if a not in ('open_market', 'open_pending', 'modify_position', 'close_position', 'modify_order', 'cancel_order', 'close_all', 'cancel_all', 'watch') then
    return jsonb_build_object('ok', false, 'error', 'Acción no válida');
  end if;
  if lg is null then
    select count(*), max(login) into n, lg from public.mt5_accounts where last_sync > now() - interval '5 seconds';
    if n <> 1 then return jsonb_build_object('ok', false, 'error', case when n = 0 then 'MT5 no está conectado' else 'Indica la cuenta' end); end if;
  end if;
  select last_sync > now() - interval '5 seconds' into online from public.mt5_accounts where login = lg;
  if not coalesce(online, false) then return jsonb_build_object('ok', false, 'error', 'MT5 no está conectado para esa cuenta. Revisa que el EA esté corriendo.'); end if;

  sym := nullif(trim(p ->> 'symbol'), '');
  if sym is not null and (length(sym) > 40 or sym !~ '^[\w .#+\-/()]+$') then return jsonb_build_object('ok', false, 'error', 'Símbolo inválido'); end if;
  begin
    if a in ('open_market', 'open_pending', 'watch') and sym is null then return jsonb_build_object('ok', false, 'error', 'Falta el símbolo'); end if;
    if a in ('open_market', 'open_pending') and not ((p ->> 'volume')::numeric > 0) then return jsonb_build_object('ok', false, 'error', 'Lotaje inválido'); end if;
    if a = 'open_market' and coalesce(p ->> 'side', '') not in ('buy', 'sell') then return jsonb_build_object('ok', false, 'error', 'Indica compra o venta'); end if;
    if a = 'open_pending' then
      if coalesce(p ->> 'order_type', '') not in ('buy_limit', 'sell_limit', 'buy_stop', 'sell_stop', 'buy_stop_limit', 'sell_stop_limit') then
        return jsonb_build_object('ok', false, 'error', 'Tipo de orden pendiente inválido'); end if;
      if not ((p ->> 'price')::numeric > 0) then return jsonb_build_object('ok', false, 'error', 'Precio inválido'); end if;
    end if;
    if a in ('modify_position', 'close_position', 'modify_order', 'cancel_order') and coalesce(p ->> 'ticket', '') !~ '^\d{1,20}$' then
      return jsonb_build_object('ok', false, 'error', 'Ticket inválido'); end if;
    if a = 'modify_position' and p ->> 'sl' is null and p ->> 'tp' is null then return jsonb_build_object('ok', false, 'error', 'Indica SL o TP'); end if;
    f := coalesce(nullif(p ->> 'filter', ''), 'all');
    if a = 'close_all' and f not in ('all', 'profit', 'loss', 'buy', 'sell') then return jsonb_build_object('ok', false, 'error', 'Filtro inválido'); end if;
    -- números válidos y no negativos
    if coalesce((p ->> 'sl')::numeric, 0) < 0 or coalesce((p ->> 'tp')::numeric, 0) < 0 or coalesce((p ->> 'volume')::numeric, 0) < 0
       or coalesce((p ->> 'price')::numeric, 0) < 0 or coalesce((p ->> 'stoplimit')::numeric, 0) < 0 then
      return jsonb_build_object('ok', false, 'error', 'Valores negativos no permitidos'); end if;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Número inválido');
  end;

  prm := jsonb_strip_nulls(jsonb_build_object(
    'symbol', sym,
    'otype', case a when 'open_market' then p ->> 'side' when 'open_pending' then p ->> 'order_type' when 'close_all' then f else null end,
    'volume', p ->> 'volume', 'price', p ->> 'price', 'sl', p ->> 'sl', 'tp', p ->> 'tp', 'ticket', p ->> 'ticket',
    'expiration', p ->> 'expiration', 'stoplimit', p ->> 'stoplimit', 'comment', left(p ->> 'comment', 31)));
  nid := to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint) || encode(extensions.gen_random_bytes(4), 'hex');
  insert into public.mt5_commands (id, login, action, params, created_by) values (nid, lg, a, prm, auth.uid());
  return jsonb_build_object('ok', true, 'command', jsonb_build_object('id', nid, 'account', lg, 'action', a, 'params', prm, 'status', 'queued',
    'createdAt', (extract(epoch from now()) * 1000)::bigint));
end $$;
grant execute on function public.mt5_panel_command(jsonb) to authenticated;
