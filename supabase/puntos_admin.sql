-- =====================================================================
-- Admin → Retos y puntos → "Top y ajustar puntos". Se puede correr varias veces.
--  - Top 10 del mes o histórico, con su saldo.
--  - Sumar o quitar puntos a cualquier alumno, con un motivo (queda registrado).
--  - Los puntos quitados también descuentan del ranking.
-- =====================================================================

-- los ajustes pueden ser negativos
alter table public.reward_bonuses drop constraint if exists reward_bonuses_points_check;
alter table public.reward_bonuses add constraint reward_bonuses_points_check check (points <> 0);

-- el ranking y el perfil público cuentan también los ajustes negativos
do $$
declare f text; d text;
begin
  foreach f in array array['public.rewards_board(text)', 'public.public_profile(text)'] loop
    begin
      d := pg_get_functiondef(f::regprocedure);
      d := replace(d, 'from public.reward_bonuses where points > 0', 'from public.reward_bonuses where points <> 0');
      execute d;
    exception when undefined_function then null;
    end;
  end loop;
end $$;

-- top para el admin (con id y saldo)
create or replace function public.admin_points_top(p_period text default 'mes', p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare desde timestamptz := case when p_period = 'total' then '-infinity'::timestamptz
  else date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota' end;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return coalesce((select jsonb_agg(t order by t.points desc, t.ultimo asc) from (
    select p.id, p.username, p.avatar_url, p.country, p.affiliate, sum(x.points)::int points, sum(x.w)::int wins,
           max(x.created_at) ultimo, public.reward_balance(p.id) saldo
    from (select user_id, points, (place is not null)::int w, created_at from public.revealed_entries() where points > 0
          union all select user_id, points, 0, created_at from public.reward_bonuses where points <> 0) x
    join public.profiles p on p.id = x.user_id
    where not p.banned and p.role <> 'admin' and x.created_at >= desde
    group by p.id having sum(x.points) > 0
    order by 6 desc, 8 asc limit greatest(1, least(p_limit, 100))) t), '[]'::jsonb);
end $$;
grant execute on function public.admin_points_top(text, int) to authenticated;

-- sumar o quitar puntos
create or replace function public.admin_adjust_points(p_username text, p_points int, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.profiles; motivo text := left(trim(coalesce(p_reason, '')), 120); saldo int;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if coalesce(p_points, 0) = 0 then raise exception 'Escribe cuántos puntos sumar (ej. 50) o quitar (ej. -50).'; end if;
  if abs(p_points) > 100000 then raise exception 'Eso es demasiado de una vez.'; end if;
  select * into u from public.profiles where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if not found then raise exception 'No encontré a %', p_username; end if;
  saldo := public.reward_balance(u.id);
  if saldo + p_points < 0 then raise exception '% tiene % puntos: no le puedes quitar %.', u.username, saldo, abs(p_points); end if;
  insert into public.reward_bonuses (user_id, kind, ref, points)
  values (u.id, 'ajuste', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS') || coalesce(' · ' || nullif(motivo, ''), ''), p_points);
  return jsonb_build_object('username', u.username, 'saldo', saldo + p_points);
end $$;
grant execute on function public.admin_adjust_points(text, int, text) to authenticated;

-- últimos ajustes hechos
create or replace function public.admin_points_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select b.created_at, b.points, p.username, nullif(split_part(b.ref, ' · ', 2), '') motivo
    from public.reward_bonuses b join public.profiles p on p.id = b.user_id
    where b.kind = 'ajuste' order by b.created_at desc limit 20) x), '[]'::jsonb);
end $$;
grant execute on function public.admin_points_log() to authenticated;
