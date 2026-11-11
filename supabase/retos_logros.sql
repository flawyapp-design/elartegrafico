-- =====================================================================
-- RACHAS, RETO SEMANAL Y LOGROS DE RETOS (requiere retos.sql)
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.
-- =====================================================================
alter table public.challenges add column if not exists weekly boolean not null default false;

-- puntos extra (bono de racha, etc.): cuentan para el saldo y el ranking
create table if not exists public.reward_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) <= 30),
  ref text not null default '',
  points int not null check (points >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
alter table public.reward_bonuses enable row level security;
drop policy if exists "bonos: ver los propios" on public.reward_bonuses;
create policy "bonos: ver los propios" on public.reward_bonuses for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "bonos: admin" on public.reward_bonuses;
create policy "bonos: admin" on public.reward_bonuses for all using (public.is_admin()) with check (public.is_admin());

-- días seguidos jugando retos (hora de Colombia); cuenta si jugó hoy o ayer
create or replace function public.challenge_streak(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with d as (select distinct (created_at at time zone 'America/Bogota')::date dia from public.challenge_entries where user_id = p_user),
  g as (select dia, dia - (row_number() over (order by dia))::int grp from d),
  s as (select grp, max(dia) fin, count(*) n from g group by grp)
  select coalesce((select n::int from s where fin >= (now() at time zone 'America/Bogota')::date - 1 order by fin desc limit 1), 0)
$$;
revoke execute on function public.challenge_streak(uuid) from public, anon, authenticated;
create or replace function public.challenge_best_streak(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with d as (select distinct (created_at at time zone 'America/Bogota')::date dia from public.challenge_entries where user_id = p_user),
  g as (select dia - (row_number() over (order by dia))::int grp from d)
  select coalesce(max(n),0)::int from (select count(*) n from g group by grp) x
$$;
revoke execute on function public.challenge_best_streak(uuid) from public, anon, authenticated;

-- saldo = puntos de retos + bonos − canjes
create or replace function public.reward_balance(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(points) from public.challenge_entries where user_id = p_user), 0)
        + coalesce((select sum(points) from public.reward_bonuses where user_id = p_user), 0)
        - coalesce((select sum(points) from public.redemptions where user_id = p_user and status <> 'rechazado'), 0))::int
$$;
revoke execute on function public.reward_balance(uuid) from public, anon, authenticated;

-- al responder: bono cada 7 días seguidos jugando (sea que acierte o no)
create or replace function public.challenge_streak_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.rewards_cfg(); st int; b int; aff boolean;
begin
  b := coalesce((cfg->>'streakBonus')::int, 50);
  if b <= 0 then return new; end if;
  st := public.challenge_streak(new.user_id);
  if st > 0 and st % 7 = 0 then
    select affiliate into aff from public.profiles where id = new.user_id;
    if not coalesce(aff,false) and coalesce((cfg->>'halfIfNotAffiliate')::boolean, true) then b := ceil(b / 2.0)::int; end if;
    insert into public.reward_bonuses (user_id, kind, ref, points)
    values (new.user_id, 'racha7', ((new.created_at at time zone 'America/Bogota')::date)::text, b)
    on conflict (user_id, kind, ref) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists challenge_streak_bonus on public.challenge_entries;
create trigger challenge_streak_bonus after insert on public.challenge_entries for each row execute function public.challenge_streak_bonus();

-- feed con el campo weekly
drop function if exists public.challenges_feed();
create function public.challenges_feed() returns table(id uuid, title text, kind text, question text, options jsonb, market text, chart_t bigint, side text, image_url text,
  points int, max_winners int, starts_at timestamptz, ends_at timestamptz, winners int, closed boolean,
  my_correct boolean, my_place int, my_points int, answered boolean, correct int, zone numeric, tol numeric, explain text, weekly boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.kind, c.question, c.options, c.market, c.chart_t, c.side, c.image_url, c.points, c.max_winners, c.starts_at, c.ends_at,
    w.n::int, (c.ends_at <= now() or w.n >= c.max_winners),
    e.correct, e.place, e.points, e.id is not null,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.correct end,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.zone end,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.tol end,
    case when c.ends_at <= now() or w.n >= c.max_winners or e.id is not null then k.explain end,
    c.weekly
  from public.challenges c
  left join public.challenge_keys k on k.challenge_id = c.id
  left join public.challenge_entries e on e.challenge_id = c.id and e.user_id = auth.uid()
  cross join lateral (select count(*) n from public.challenge_entries x where x.challenge_id = c.id and x.place is not null) w
  where c.status = 'publicado' and c.starts_at <= now() and c.starts_at > now() - interval '45 days'
  order by c.weekly desc, c.starts_at desc limit 40
$$;
grant execute on function public.challenges_feed() to anon, authenticated;

-- ranking con bonos incluidos
drop function if exists public.rewards_board(text);
create function public.rewards_board(p_period text default 'mes') returns table(username text, avatar_url text, country text, premium boolean, affiliate boolean, points int, wins int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with desde as (select case when p_period = 'total' then '-infinity'::timestamptz else date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota' end t),
  pts as (
    select user_id, points, (place is not null)::int w, created_at from public.challenge_entries where points > 0
    union all select user_id, points, 0, created_at from public.reward_bonuses where points > 0)
  select p.username, p.avatar_url, p.country, coalesce(p.premium_until > now(), false), p.affiliate,
         sum(x.points)::int, sum(x.w)::int, coalesce(x.user_id = auth.uid(), false)
  from pts x join public.profiles p on p.id = x.user_id, desde
  where not p.banned and p.role <> 'admin' and x.created_at >= desde.t
  group by p.id, x.user_id order by 6 desc, max(x.created_at) asc limit 100
$$;
grant execute on function public.rewards_board(text) to anon, authenticated;

-- mis puntos + datos para logros de retos
drop function if exists public.my_rewards();
create function public.my_rewards() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); a public.affiliates; m timestamptz := date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
begin
  if u is null then return null; end if;
  select * into a from public.affiliates where user_id = u;
  return jsonb_build_object(
    'balance', public.reward_balance(u),
    'earned', coalesce((select sum(points) from public.challenge_entries where user_id = u), 0) + coalesce((select sum(points) from public.reward_bonuses where user_id = u), 0),
    'month', coalesce((select sum(points) from public.challenge_entries where user_id = u and created_at >= m), 0) + coalesce((select sum(points) from public.reward_bonuses where user_id = u and created_at >= m), 0),
    'wins', (select count(*) from public.challenge_entries where user_id = u and place is not null),
    'played', (select count(*) from public.challenge_entries where user_id = u),
    'correct', (select count(*) from public.challenge_entries where user_id = u and correct),
    'firsts', (select count(*) from public.challenge_entries where user_id = u and place = 1),
    'podiums', (select count(*) from public.challenge_entries where user_id = u and place <= 3),
    'weekly_wins', (select count(*) from public.challenge_entries e join public.challenges c on c.id = e.challenge_id where e.user_id = u and e.place is not null and c.weekly),
    'kinds', (select count(distinct c.kind) from public.challenge_entries e join public.challenges c on c.id = e.challenge_id where e.user_id = u and e.correct),
    'streak', public.challenge_streak(u), 'best_streak', public.challenge_best_streak(u),
    'played_today', exists(select 1 from public.challenge_entries where user_id = u and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date),
    'bonus', coalesce((select sum(points) from public.reward_bonuses where user_id = u), 0),
    'paid', (select count(*) from public.redemptions where user_id = u and status = 'pagado'),
    'affiliate', coalesce(a.status, 'ninguno'), 'deriv_id', a.deriv_id, 'affiliate_note', a.admin_note,
    'redemptions', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.created_at desc) from (select * from public.redemptions where user_id = u order by created_at desc limit 20) r), '[]'::jsonb));
end $$;
grant execute on function public.my_rewards() to authenticated;
