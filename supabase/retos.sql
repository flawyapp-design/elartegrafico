-- =====================================================================
-- RETOS DIARIOS, PUNTOS, AFILIADOS DERIV Y CANJES (El Arte Gráfico)
-- + TABLA DE PROGRESO DE LA ACADEMIA
-- Pégalo completo en Supabase → SQL Editor → Run. Se puede correr varias veces.
-- Todo arranca APAGADO: lo activas en Administración → Retos y puntos → Ajustes.
-- =====================================================================

-- ---------- ajustes (se guardan en site_settings.data.rewards) ----------
create or replace function public.rewards_cfg() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data->'rewards' from public.site_settings where id = 1), '{}'::jsonb)
$$;

-- ---------- afiliado (socio de Deriv verificado) ----------
alter table public.profiles add column if not exists affiliate boolean not null default false;

create table if not exists public.affiliates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  deriv_id text not null check (char_length(deriv_id) between 3 and 40),
  status text not null default 'pendiente' check (status in ('pendiente','verificado','rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.affiliates enable row level security;
drop policy if exists "afiliado: ver el propio" on public.affiliates;
create policy "afiliado: ver el propio" on public.affiliates for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "afiliado: admin" on public.affiliates;
create policy "afiliado: admin" on public.affiliates for all using (public.is_admin()) with check (public.is_admin());

-- el alumno envía (o reenvía) su ID de Deriv
create or replace function public.request_affiliate(p_deriv text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.affiliates; d text := upper(regexp_replace(coalesce(p_deriv,''), '\s', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(d) < 3 or char_length(d) > 40 then raise exception 'Escribe tu ID de cliente de Deriv (ej.: CR1234567)'; end if;
  if exists (select 1 from public.affiliates where upper(deriv_id) = d and user_id <> auth.uid() and status <> 'rechazado') then
    raise exception 'Ese ID de Deriv ya está registrado por otra cuenta'; end if;
  select * into cur from public.affiliates where user_id = auth.uid();
  if found and cur.status = 'verificado' then raise exception 'Ya eres afiliado verificado'; end if;
  insert into public.affiliates (user_id, deriv_id, status, admin_note, created_at, reviewed_at)
  values (auth.uid(), d, 'pendiente', '', now(), null)
  on conflict (user_id) do update set deriv_id = excluded.deriv_id, status = 'pendiente', admin_note = '', created_at = now(), reviewed_at = null;
  return jsonb_build_object('status','pendiente');
end $$;
grant execute on function public.request_affiliate(text) to authenticated;

drop function if exists public.admin_affiliates();
create function public.admin_affiliates() returns table(user_id uuid, username text, email text, country text, deriv_id text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select a.user_id, p.username, u.email::text, p.country, a.deriv_id, a.status, a.admin_note, a.created_at, a.reviewed_at
    from public.affiliates a join public.profiles p on p.id = a.user_id join auth.users u on u.id = a.user_id
    order by (a.status = 'pendiente') desc, a.created_at desc limit 500;
end $$;
grant execute on function public.admin_affiliates() to authenticated;

create or replace function public.review_affiliate(p_user uuid, p_ok boolean, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  update public.affiliates set status = case when p_ok then 'verificado' else 'rechazado' end, admin_note = coalesce(p_note,''), reviewed_at = now() where user_id = p_user;
  if not found then raise exception 'Esa solicitud no existe'; end if;
  update public.profiles set affiliate = p_ok where id = p_user;
end $$;
grant execute on function public.review_affiliate(uuid, boolean, text) to authenticated;

-- ---------- retos ----------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  kind text not null default 'opcion' check (kind in ('opcion','tendencia','zona')),
  question text not null default '' check (char_length(question) <= 600),
  options jsonb not null default '[]'::jsonb,           -- textos de las opciones (opción y tendencia)
  market text not null default '',                      -- p. ej. BOOM1000 (tendencia y zona)
  chart_t bigint,                                       -- última vela visible (segundos unix, H1)
  side text not null default 'buy' check (side in ('buy','sell')),
  image_url text not null default '',
  points int not null default 100 check (points between 1 and 100000),
  max_winners int not null default 5 check (max_winners between 1 and 100),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '1 day'),
  status text not null default 'borrador' check (status in ('borrador','publicado')),
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;
drop policy if exists "retos: ver publicados" on public.challenges;
create policy "retos: ver publicados" on public.challenges for select using ((status = 'publicado' and starts_at <= now()) or public.is_admin());
drop policy if exists "retos: admin" on public.challenges;
create policy "retos: admin" on public.challenges for all using (public.is_admin()) with check (public.is_admin());

-- respuesta correcta: solo la ve el admin (los alumnos la ven cuando el reto cierra)
create table if not exists public.challenge_keys (
  challenge_id uuid primary key references public.challenges(id) on delete cascade,
  correct int,                 -- índice de la opción correcta (opción / tendencia)
  zone numeric, tol numeric,   -- precio de la zona y margen permitido (zona)
  explain text not null default ''
);
alter table public.challenge_keys enable row level security;
drop policy if exists "llaves: admin" on public.challenge_keys;
create policy "llaves: admin" on public.challenge_keys for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  correct boolean not null default false,
  place int,                   -- 1..max_winners si ganó puntos
  points int not null default 0,
  affiliate boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  unique (challenge_id, user_id)
);
create index if not exists challenge_entries_user_idx on public.challenge_entries (user_id, created_at desc);
alter table public.challenge_entries enable row level security;
drop policy if exists "intentos: ver los propios" on public.challenge_entries;
create policy "intentos: ver los propios" on public.challenge_entries for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "intentos: admin" on public.challenge_entries;
create policy "intentos: admin" on public.challenge_entries for all using (public.is_admin()) with check (public.is_admin());

-- responder un reto: todo se decide aquí (acierto, puesto y puntos)
create or replace function public.submit_challenge(p_id uuid, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.challenges; k public.challenge_keys; cfg jsonb := public.rewards_cfg(); pr public.profiles;
  ok boolean := false; wins int; pl int; pts int := 0; v numeric;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para participar'; end if;
  if not coalesce((cfg->>'enabled')::boolean, false) then raise exception 'Los retos todavía no están activos'; end if;
  select * into pr from public.profiles where id = auth.uid();
  if pr.banned then raise exception 'Tu cuenta está suspendida'; end if;
  select * into c from public.challenges where id = p_id for update;      -- un solo intento a la vez por reto
  if not found or c.status <> 'publicado' or c.starts_at > now() then raise exception 'Ese reto no está disponible'; end if;
  if c.ends_at <= now() then raise exception 'Este reto ya cerró'; end if;
  if exists (select 1 from public.challenge_entries where challenge_id = p_id and user_id = auth.uid()) then raise exception 'Ya respondiste este reto'; end if;
  select * into k from public.challenge_keys where challenge_id = p_id;
  if c.kind in ('opcion','tendencia') then
    ok := k.correct is not null and (p_answer->>'option') ~ '^\d+$' and (p_answer->>'option')::int = k.correct;
  else
    begin v := (p_answer->>'price')::numeric; exception when others then v := null; end;
    ok := v is not null and k.zone is not null and abs(v - k.zone) <= coalesce(k.tol, 0);
  end if;
  select count(*) into wins from public.challenge_entries where challenge_id = p_id and place is not null;
  if ok and wins < c.max_winners then
    pl := wins + 1;
    pts := case when pr.affiliate or not coalesce((cfg->>'halfIfNotAffiliate')::boolean, true) then c.points else ceil(c.points / 2.0)::int end;
  end if;
  insert into public.challenge_entries (challenge_id, user_id, answer, correct, place, points, affiliate)
  values (p_id, auth.uid(), coalesce(p_answer,'{}'::jsonb), ok, pl, pts, pr.affiliate);
  return jsonb_build_object('correct', ok, 'place', pl, 'points', pts, 'affiliate', pr.affiliate,
    'full_points', c.points, 'winners_left', greatest(0, c.max_winners - wins - case when pl is not null then 1 else 0 end));
end $$;
grant execute on function public.submit_challenge(uuid, jsonb) to authenticated;

-- lista de retos (con mi intento, cupos y la respuesta solo si ya cerró)
drop function if exists public.challenges_feed();
create function public.challenges_feed() returns table(id uuid, title text, kind text, question text, options jsonb, market text, chart_t bigint, side text, image_url text,
  points int, max_winners int, starts_at timestamptz, ends_at timestamptz, winners int, closed boolean,
  my_correct boolean, my_place int, my_points int, answered boolean, correct int, zone numeric, tol numeric, explain text)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.kind, c.question, c.options, c.market, c.chart_t, c.side, c.image_url, c.points, c.max_winners, c.starts_at, c.ends_at,
    w.n::int, (c.ends_at <= now() or w.n >= c.max_winners),
    e.correct, e.place, e.points, e.id is not null,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.correct end,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.zone end,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.tol end,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.explain end
  from public.challenges c
  left join public.challenge_keys k on k.challenge_id = c.id
  left join public.challenge_entries e on e.challenge_id = c.id and e.user_id = auth.uid()
  cross join lateral (select count(*) n from public.challenge_entries x where x.challenge_id = c.id and x.place is not null) w
  where c.status = 'publicado' and c.starts_at <= now() and c.starts_at > now() - interval '45 days'
  order by c.starts_at desc limit 40
$$;
grant execute on function public.challenges_feed() to anon, authenticated;

-- ganadores de un reto (público)
drop function if exists public.challenge_winners(uuid);
create function public.challenge_winners(p_id uuid) returns table(place int, username text, avatar_url text, country text, premium boolean, affiliate boolean, points int, at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.place, p.username, p.avatar_url, p.country, coalesce(p.premium_until > now(), false), p.affiliate, e.points, e.created_at
  from public.challenge_entries e join public.profiles p on p.id = e.user_id
  where e.challenge_id = p_id and e.place is not null order by e.place
$$;
grant execute on function public.challenge_winners(uuid) to anon, authenticated;

-- ---------- canjes ----------
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  points int not null check (points > 0),
  usd numeric(10,2) not null default 0,
  method text not null default 'binance' check (char_length(method) <= 30),
  account text not null check (char_length(account) between 3 and 120),
  status text not null default 'pendiente' check (status in ('pendiente','pagado','rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.redemptions enable row level security;
drop policy if exists "canjes: ver los propios" on public.redemptions;
create policy "canjes: ver los propios" on public.redemptions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "canjes: admin" on public.redemptions;
create policy "canjes: admin" on public.redemptions for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.reward_balance(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(points) from public.challenge_entries where user_id = p_user), 0)
        - coalesce((select sum(points) from public.redemptions where user_id = p_user and status <> 'rechazado'), 0))::int
$$;
revoke execute on function public.reward_balance(uuid) from public, anon, authenticated;

drop function if exists public.my_rewards();
create function public.my_rewards() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); a public.affiliates;
begin
  if u is null then return null; end if;
  select * into a from public.affiliates where user_id = u;
  return jsonb_build_object(
    'balance', public.reward_balance(u),
    'earned', coalesce((select sum(points) from public.challenge_entries where user_id = u), 0),
    'month', coalesce((select sum(points) from public.challenge_entries where user_id = u and created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'), 0),
    'wins', (select count(*) from public.challenge_entries where user_id = u and place is not null),
    'played', (select count(*) from public.challenge_entries where user_id = u),
    'affiliate', coalesce(a.status, 'ninguno'), 'deriv_id', a.deriv_id, 'affiliate_note', a.admin_note,
    'redemptions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at desc) from (select * from public.redemptions where user_id = u order by created_at desc limit 20) r), '[]'::jsonb));
end $$;
grant execute on function public.my_rewards() to authenticated;

create or replace function public.request_redemption(p_points int, p_method text, p_account text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.rewards_cfg(); bal int; rate numeric; mn int; r public.redemptions;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if not coalesce((cfg->>'enabled')::boolean, false) or not coalesce((cfg->>'redeemOpen')::boolean, false) then
    raise exception 'Los canjes están cerrados por ahora. Tus puntos se siguen acumulando.'; end if;
  if exists (select 1 from public.redemptions where user_id = auth.uid() and status = 'pendiente') then raise exception 'Ya tienes un canje en revisión'; end if;
  rate := greatest(1, coalesce((cfg->>'ptsPerUsd')::numeric, 100)); mn := coalesce((cfg->>'minRedeem')::int, 500);
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  bal := public.reward_balance(auth.uid());
  if p_points is null or p_points < mn then raise exception 'El mínimo para canjear es % puntos', mn; end if;
  if p_points > bal then raise exception 'No tienes puntos suficientes (tienes %)', bal; end if;
  insert into public.redemptions (user_id, points, usd, method, account) values (auth.uid(), p_points, round(p_points / rate, 2), coalesce(nullif(p_method,''),'binance'), trim(coalesce(p_account,'')))
  returning * into r;
  return to_jsonb(r);
end $$;
grant execute on function public.request_redemption(int, text, text) to authenticated;

drop function if exists public.admin_redemptions();
create function public.admin_redemptions() returns table(id uuid, user_id uuid, username text, email text, affiliate boolean, points int, usd numeric, method text, account text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz, balance int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select r.id, r.user_id, p.username, u.email::text, p.affiliate, r.points, r.usd, r.method, r.account, r.status, r.admin_note, r.created_at, r.reviewed_at, public.reward_balance(r.user_id)
    from public.redemptions r join public.profiles p on p.id = r.user_id join auth.users u on u.id = r.user_id
    order by (r.status = 'pendiente') desc, r.created_at desc limit 500;
end $$;
grant execute on function public.admin_redemptions() to authenticated;

create or replace function public.review_redemption(p_id uuid, p_paid boolean, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  update public.redemptions set status = case when p_paid then 'pagado' else 'rechazado' end, admin_note = coalesce(p_note,''), reviewed_at = now()
   where id = p_id and status = 'pendiente';
  if not found then raise exception 'Ese canje ya fue revisado'; end if;
end $$;
grant execute on function public.review_redemption(uuid, boolean, text) to authenticated;

-- ---------- ranking de puntos (El Arte Gráfico) ----------
drop function if exists public.rewards_board(text);
create function public.rewards_board(p_period text default 'mes') returns table(username text, avatar_url text, country text, premium boolean, affiliate boolean, points int, wins int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.username, p.avatar_url, p.country, coalesce(p.premium_until > now(), false), p.affiliate,
         sum(e.points)::int, count(e.place)::int, coalesce(e.user_id = auth.uid(), false)
  from public.challenge_entries e join public.profiles p on p.id = e.user_id
  where not p.banned and p.role <> 'admin' and e.points > 0
    and (p_period = 'total' or e.created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota')
  group by p.id, e.user_id order by 6 desc, max(e.created_at) asc limit 100
$$;
grant execute on function public.rewards_board(text) to anon, authenticated;

-- ---------- admin: intentos de un reto ----------
drop function if exists public.admin_challenge_entries(uuid);
create function public.admin_challenge_entries(p_id uuid) returns table(username text, country text, affiliate boolean, correct boolean, place int, points int, answer jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.username, p.country, e.affiliate, e.correct, e.place, e.points, e.answer, e.created_at
    from public.challenge_entries e join public.profiles p on p.id = e.user_id where e.challenge_id = p_id order by e.created_at limit 1000;
end $$;
grant execute on function public.admin_challenge_entries(uuid) to authenticated;

-- ---------- tabla de progreso de la academia (sin puntos: por lecciones aprobadas) ----------
drop function if exists public.progress_board();
create function public.progress_board() returns table(username text, avatar_url text, country text, premium boolean, affiliate boolean, lessons int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.username, p.avatar_url, p.country, coalesce(p.premium_until > now(), false), p.affiliate,
         coalesce((select count(*) from jsonb_each(g.data->'done') d where (d.value->>'passed')::boolean), 0)::int as l,
         coalesce(g.user_id = auth.uid(), false)
  from public.progress g join public.profiles p on p.id = g.user_id
  where not p.banned and p.role <> 'admin'
  order by l desc, g.updated_at asc limit 100
$$;
grant execute on function public.progress_board() to anon, authenticated;
