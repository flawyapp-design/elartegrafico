-- =====================================================================
-- Retos con suspenso. Correr DESPUÉS de retos.sql, retos_logros.sql y retos_seguridad.sql.
-- Se puede correr varias veces.
--  - Cada reto diario dura 3 horas desde que se publica (se cambia en Admin → Retos → Ajustes:
--    "Horas que dura cada reto"). Los semanales usan su propia hora de cierre.
--  - El reto NO se cierra al llenarse los cupos: todos pueden responder hasta el final.
--  - Mientras está abierto nadie sabe si acertó ni cuántos cupos quedan.
--  - Al cerrar se revelan juntos: respuesta, explicación, los ganadores y los puntos.
--    Los ganadores siguen siendo los primeros en acertar (orden de llegada al servidor).
--  - Los puntos de un reto abierto no cuentan en el saldo, el ranking ni los logros hasta que cierre.
-- =====================================================================

-- hora de cierre (= hora de revelar resultados)
create or replace function public.challenge_close_at(p_starts timestamptz, p_ends timestamptz, p_weekly boolean) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when coalesce(p_weekly, false) then p_ends
    else p_starts + make_interval(mins => (greatest(0.25, least(48, coalesce((public.rewards_cfg()->>'revealHours')::numeric, 3))) * 60)::int) end
$$;
grant execute on function public.challenge_close_at(timestamptz, timestamptz, boolean) to anon, authenticated;

-- ¿ya se revelaron los resultados de este reto?
create or replace function public.challenge_revealed(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now() from public.challenges c where c.id = p_id), false)
$$;
revoke execute on function public.challenge_revealed(uuid) from public, anon, authenticated;

-- los alumnos ya no leen sus intentos directo (verían si acertaron antes de tiempo)
drop policy if exists "intentos: ver los propios" on public.challenge_entries;
create policy "intentos: ver los propios" on public.challenge_entries for select using (public.is_admin());

-- los retos diarios guardan su cierre real (para que admin y alumnos vean lo mismo)
update public.challenges set ends_at = public.challenge_close_at(starts_at, ends_at, weekly)
where not weekly and starts_at > now() - interval '1 day' and ends_at <> public.challenge_close_at(starts_at, ends_at, weekly);

-- responder: se guarda todo, pero no se dice si acertó hasta el cierre
create or replace function public.submit_challenge(p_id uuid, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.challenges; k public.challenge_keys; cfg jsonb := public.rewards_cfg(); pr public.profiles;
  ok boolean := false; wins int; pl int; pts int := 0; v numeric; born timestamptz; why text := null; cl timestamptz;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para participar'; end if;
  if not coalesce((cfg->>'enabled')::boolean, false) then raise exception 'Los retos todavía no están activos'; end if;
  select * into pr from public.profiles where id = auth.uid();
  if pr.banned then raise exception 'Tu cuenta está suspendida'; end if;
  select * into c from public.challenges where id = p_id for update;
  if not found or c.status <> 'publicado' or c.starts_at > now() then raise exception 'Ese reto no está disponible'; end if;
  cl := public.challenge_close_at(c.starts_at, c.ends_at, c.weekly);
  if cl <= now() then raise exception 'Este reto ya cerró'; end if;
  if exists (select 1 from public.challenge_entries where challenge_id = p_id and user_id = auth.uid()) then raise exception 'Ya respondiste este reto'; end if;
  select * into k from public.challenge_keys where challenge_id = p_id;
  if c.kind in ('opcion','tendencia') then
    ok := k.correct is not null and (p_answer->>'option') ~ '^\d+$' and (p_answer->>'option')::int = k.correct;
  else
    begin v := (p_answer->>'price')::numeric - coalesce(c.off, 0); exception when others then v := null; end;
    ok := v is not null and k.zone is not null and abs(v - k.zone) <= coalesce(k.tol, 0);
  end if;
  select created_at into born from auth.users where id = auth.uid();
  if born > c.starts_at then why := 'cuenta_nueva'; end if;
  select count(*) into wins from public.challenge_entries where challenge_id = p_id and place is not null;
  if ok and wins < c.max_winners and why is null then
    pl := wins + 1;
    pts := case when pr.affiliate or not coalesce((cfg->>'halfIfNotAffiliate')::boolean, true) then c.points else ceil(c.points / 2.0)::int end;
  end if;
  insert into public.challenge_entries (challenge_id, user_id, answer, correct, place, points, affiliate, ip_hash)
  values (p_id, auth.uid(), coalesce(p_answer,'{}'::jsonb), ok, pl, pts, pr.affiliate, public.req_ip_hash());
  return jsonb_build_object('received', true, 'reveal_at', cl, 'reason', why);
end $$;
grant execute on function public.submit_challenge(uuid, jsonb) to authenticated;

-- lista de retos: ends_at = hora de revelar; resultados solo cuando cierra
drop function if exists public.challenges_feed();
create function public.challenges_feed() returns table(id uuid, title text, kind text, question text, options jsonb, market text, chart_t bigint, side text, image_url text,
  points int, max_winners int, starts_at timestamptz, ends_at timestamptz, winners int, closed boolean,
  my_correct boolean, my_place int, my_points int, answered boolean, correct int, zone numeric, tol numeric, explain text, weekly boolean,
  bars jsonb, after_bars jsonb, decimals int, my_answer jsonb, players int)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.kind, c.question, c.options, c.market, null::bigint, c.side, c.image_url, c.points, c.max_winners, c.starts_at, x.cl,
    case when x.done then w.n::int end, x.done,
    case when x.done then e.correct end, case when x.done then e.place end, case when x.done then e.points end, e.id is not null,
    case when x.done then k.correct end,
    case when x.done then k.zone + coalesce(c.off, 0) end,
    case when x.done then k.tol end,
    case when x.done then k.explain end,
    c.weekly, c.bars,
    case when x.done then c.after_bars end,
    c.decimals, e.answer, w.p::int
  from public.challenges c
  cross join lateral (select public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) cl) x0
  cross join lateral (select x0.cl, x0.cl <= now() done) x
  left join public.challenge_keys k on k.challenge_id = c.id
  left join public.challenge_entries e on e.challenge_id = c.id and e.user_id = auth.uid()
  cross join lateral (select count(*) filter (where y.place is not null) n, count(*) p from public.challenge_entries y where y.challenge_id = c.id) w
  where c.status = 'publicado' and c.starts_at <= now() and c.starts_at > now() - interval '45 days'
  order by c.weekly desc, c.starts_at desc limit 40
$$;
grant execute on function public.challenges_feed() to anon, authenticated;

-- ganadores: vacío hasta que cierre
drop function if exists public.challenge_winners(uuid);
create function public.challenge_winners(p_id uuid) returns table(place int, username text, avatar_url text, country text, premium boolean, affiliate boolean, points int, at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.place, p.username, p.avatar_url, p.country, coalesce(p.premium_until > now(), false), p.affiliate, e.points, e.created_at
  from public.challenge_entries e join public.profiles p on p.id = e.user_id
  where e.challenge_id = p_id and e.place is not null and public.challenge_revealed(p_id) order by e.place
$$;
grant execute on function public.challenge_winners(uuid) to anon, authenticated;

-- intentos ya revelados (los de retos abiertos no cuentan todavía)
create or replace function public.revealed_entries() returns setof public.challenge_entries
language sql stable security definer set search_path = public as $$
  select e.* from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
  where public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now()
$$;
revoke execute on function public.revealed_entries() from public, anon, authenticated;

create or replace function public.reward_balance(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(points) from public.revealed_entries() where user_id = p_user), 0)
        + coalesce((select sum(points) from public.reward_bonuses where user_id = p_user), 0)
        - coalesce((select sum(points) from public.redemptions where user_id = p_user and status <> 'rechazado'), 0))::int
$$;
revoke execute on function public.reward_balance(uuid) from public, anon, authenticated;

drop function if exists public.rewards_board(text);
create function public.rewards_board(p_period text default 'mes') returns table(username text, avatar_url text, country text, premium boolean, affiliate boolean, points int, wins int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with desde as (select case when p_period = 'total' then '-infinity'::timestamptz else date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota' end t),
  pts as (
    select user_id, points, (place is not null)::int w, created_at from public.revealed_entries() where points > 0
    union all select user_id, points, 0, created_at from public.reward_bonuses where points > 0)
  select p.username, p.avatar_url, p.country, coalesce(p.premium_until > now(), false), p.affiliate,
         sum(x.points)::int, sum(x.w)::int, coalesce(x.user_id = auth.uid(), false)
  from pts x join public.profiles p on p.id = x.user_id, desde
  where not p.banned and p.role <> 'admin' and x.created_at >= desde.t
  group by p.id, x.user_id order by 6 desc, max(x.created_at) asc limit 100
$$;
grant execute on function public.rewards_board(text) to anon, authenticated;

drop function if exists public.my_rewards();
create function public.my_rewards() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); a public.affiliates; m timestamptz := date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
begin
  if u is null then return null; end if;
  select * into a from public.affiliates where user_id = u;
  return (with r as (select * from public.revealed_entries() where user_id = u)
  select jsonb_build_object(
    'balance', public.reward_balance(u),
    'earned', coalesce((select sum(points) from r), 0) + coalesce((select sum(points) from public.reward_bonuses where user_id = u), 0),
    'month', coalesce((select sum(points) from r where created_at >= m), 0) + coalesce((select sum(points) from public.reward_bonuses where user_id = u and created_at >= m), 0),
    'wins', (select count(*) from r where place is not null),
    'played', (select count(*) from public.challenge_entries where user_id = u),
    'pending', (select count(*) from public.challenge_entries where user_id = u) - (select count(*) from r),
    'correct', (select count(*) from r where correct),
    'firsts', (select count(*) from r where place = 1),
    'podiums', (select count(*) from r where place <= 3),
    'weekly_wins', (select count(*) from r join public.challenges c on c.id = r.challenge_id where r.place is not null and c.weekly),
    'kinds', (select count(distinct c.kind) from r join public.challenges c on c.id = r.challenge_id where r.correct),
    'streak', public.challenge_streak(u), 'best_streak', public.challenge_best_streak(u),
    'played_today', exists(select 1 from public.challenge_entries where user_id = u and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date),
    'bonus', coalesce((select sum(points) from public.reward_bonuses where user_id = u), 0),
    'paid', (select count(*) from public.redemptions where user_id = u and status = 'pagado'),
    'affiliate', coalesce(a.status, 'ninguno'), 'deriv_id', a.deriv_id, 'affiliate_note', a.admin_note,
    'redemptions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.created_at desc) from (select * from public.redemptions where user_id = u order by created_at desc limit 20) x), '[]'::jsonb)));
end $$;
grant execute on function public.my_rewards() to authenticated;

-- 3 horas por defecto
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.site_settings set data = jsonb_set(data, '{rewards}', coalesce(data->'rewards', '{}'::jsonb) || '{"revealHours":3}'::jsonb)
where id = 1 and not coalesce(data->'rewards' ? 'revealHours', false);

-- =====================================================================
-- Notificaciones automáticas de los retos
--  - A la hora de publicación sale "🎯 Nuevo reto" (aunque lo hayas programado días antes).
--  - Al cierre sale "🏆 Ya salieron los ganadores" (se apaga en Admin → Ajustes de puntos).
--  - Lo hace Supabase solo cada minuto (pg_cron + pg_net) llamando a la función send-push.
--  - Requiere volver a desplegar la función send-push con el código nuevo.
-- =====================================================================
alter table public.challenges add column if not exists notify boolean not null default true;
alter table public.challenges add column if not exists notified_at timestamptz;
alter table public.challenges add column if not exists results_notified_at timestamptz;
-- lo que ya salió o ya cerró no se vuelve a avisar
update public.challenges set notified_at = now() where notified_at is null and status = 'publicado' and starts_at <= now();
update public.challenges set results_notified_at = now()
where results_notified_at is null and status = 'publicado' and public.challenge_close_at(starts_at, ends_at, weekly) <= now();

alter table public.push_config add column if not exists cron_secret text;
update public.push_config set cron_secret = md5(random()::text || clock_timestamp()::text) || md5(random()::text) where cron_secret is null;

-- ¿hay algo por avisar?
create or replace function public.reto_push_due() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges c where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now())
      or exists (select 1 from public.challenges c where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now())
$$;
revoke execute on function public.reto_push_due() from public, anon, authenticated;

-- la función send-push toma los avisos pendientes (cada uno se entrega una sola vez)
create or replace function public.reto_push_claim() returns table(id uuid, what text, title text, points int, max_winners int, close_at timestamptz, weekly boolean)
language plpgsql security definer set search_path = public as $$
declare res boolean := coalesce((public.rewards_cfg()->>'pushResults')::boolean, true);
begin
  return query
    with n as (update public.challenges c set notified_at = now()
               where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now() returning c.*)
    select n.id, 'nuevo'::text, n.title, n.points, n.max_winners, public.challenge_close_at(n.starts_at, n.ends_at, n.weekly), n.weekly
    from n where n.notify and n.starts_at > now() - interval '2 hours';
  return query
    with r as (update public.challenges c set results_notified_at = now()
               where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now() returning c.*)
    select r.id, 'resultados'::text, r.title, r.points, r.max_winners, public.challenge_close_at(r.starts_at, r.ends_at, r.weekly), r.weekly
    from r where res and r.notify and public.challenge_close_at(r.starts_at, r.ends_at, r.weekly) > now() - interval '2 hours'
      and exists (select 1 from public.challenge_entries e where e.challenge_id = r.id);
end $$;
revoke execute on function public.reto_push_claim() from public, anon, authenticated;
grant execute on function public.reto_push_claim() to service_role;

-- revisión cada minuto: solo llama a la función si hay algo por avisar
create or replace function public.reto_push_tick() returns void
language plpgsql security definer set search_path = public as $$
declare sec text; k text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaW1tZWNwenZodm53empsanhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI0OTQsImV4cCI6MjEwOTc2ODQ5NH0.yHoJUR4e_eN29TRcKFclNyUgR2g0Glk_IARbJ8438Nc';
begin
  if not public.reto_push_due() then return; end if;
  select cron_secret into sec from public.push_config where id = 1;
  if sec is null then return; end if;   -- las notificaciones aún no están configuradas
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://animmecpzvhvnwzjljxg.supabase.co/functions/v1/send-push', '{"action":"cron"}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k, 'apikey', k, 'x-cron-secret', sec);
end $$;
revoke execute on function public.reto_push_tick() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.unschedule(jobid) from cron.job where jobname = 'retos-avisos';
  perform cron.schedule('retos-avisos', '* * * * *', 'select public.reto_push_tick()');
exception when others then
  raise notice 'No se pudo programar el aviso automático (%). Activa pg_cron y pg_net en Database → Extensions y vuelve a correr este archivo.', sqlerrm;
end $$;
