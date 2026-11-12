-- =====================================================================
-- Retos express: premios en dólares (USD), no puntos, y saldo que se puede retirar cuando quieras.
-- Correr DESPUÉS de puntos_admin.sql y pagos_chat.sql. Se puede correr varias veces.
--  - Un reto express dura lo que tú digas (por ejemplo 30 minutos). Al cerrar se revelan los ganadores.
--  - Los primeros en acertar ganan US$ (no puntos). Va a su "Saldo", que pueden pedir retirar al instante.
--  - Los afiliados verificados de Deriv ganan el premio completo; el resto, la mitad (igual que los puntos).
--  - Cada retiro te llega como mensaje en Mensajes (con aviso al celular) y lo marcas pagado en Admin → Canjes.
-- =====================================================================

alter table public.challenges add column if not exists express boolean not null default false;
alter table public.challenges add column if not exists prize_usd numeric(10,2) not null default 0;
alter table public.challenges drop constraint if exists challenges_prize_usd_check;
alter table public.challenges add constraint challenges_prize_usd_check check (prize_usd >= 0 and prize_usd <= 1000);
alter table public.challenge_entries add column if not exists usd numeric(10,2) not null default 0;

-- un reto express cierra a la hora que pusiste (como el semanal), no a las 3 horas
do $$
declare f record; d text; n text;
begin
  for f in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.prokind = 'f' and p.proname <> 'challenge_close_at'
             and pg_get_functiondef(p.oid) like '%challenge_close_at(%' loop
    d := pg_get_functiondef(f.sig::regprocedure);
    n := regexp_replace(d, 'challenge_close_at\((\w+\.)?starts_at, (\w+\.)?ends_at, (\w+\.)?weekly\)',
                        'challenge_close_at(\1starts_at, \2ends_at, \3weekly or \3express)', 'g');
    if n <> d then execute n; end if;
  end loop;
end $$;

-- premio en USD en vez de puntos (se decide al guardar la respuesta)
create or replace function public.express_premio() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.challenges; cfg jsonb := public.rewards_cfg();
begin
  select * into c from public.challenges where id = new.challenge_id;
  if c.express then
    new.usd := case when new.place is null then 0
      when new.affiliate or not coalesce((cfg->>'halfIfNotAffiliate')::boolean, true) then c.prize_usd
      else round(c.prize_usd / 2, 2) end;
    new.points := 0;
  end if;
  return new;
end $$;
drop trigger if exists express_premio on public.challenge_entries;
create trigger express_premio before insert or update of place on public.challenge_entries
  for each row execute function public.express_premio();

-- retiros de saldo
create table if not exists public.usd_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  usd numeric(10,2) not null check (usd > 0),
  method text not null default 'binance' check (char_length(method) <= 30),
  account text not null check (char_length(account) between 3 and 120),
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.usd_withdrawals enable row level security;
drop policy if exists "retiros: ver los propios" on public.usd_withdrawals;
create policy "retiros: ver los propios" on public.usd_withdrawals for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "retiros: admin" on public.usd_withdrawals;
create policy "retiros: admin" on public.usd_withdrawals for all using (public.is_admin()) with check (public.is_admin());

-- saldo en USD: premios de retos express ya revelados − retiros (menos los rechazados)
create or replace function public.usd_balance(p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(coalesce((select sum(e.usd) from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
                          where e.user_id = p_user and e.usd > 0
                            and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) <= now()), 0)
             - coalesce((select sum(usd) from public.usd_withdrawals where user_id = p_user and status <> 'rechazado'), 0), 2)
$$;
revoke execute on function public.usd_balance(uuid) from public, anon, authenticated;

-- mi billetera: saldo en USD y puntos
create or replace function public.my_wallet() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb := public.rewards_cfg(); pts int; ppu numeric;
begin
  if auth.uid() is null then return null; end if;
  pts := public.reward_balance(auth.uid());
  ppu := greatest(1, coalesce((cfg->>'ptsPerUsd')::numeric, 100));
  return jsonb_build_object(
    'usd', public.usd_balance(auth.uid()),
    'usd_ganado', coalesce((select sum(e.usd) from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
                            where e.user_id = auth.uid() and e.usd > 0
                              and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) <= now()), 0),
    'points', pts, 'points_usd', round(pts / ppu, 2),
    'min_usd', coalesce((cfg->>'usdMin')::numeric, 1),
    'retiros', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id' order by w.created_at desc) from
                 (select * from public.usd_withdrawals where user_id = auth.uid() order by created_at desc limit 10) w), '[]'::jsonb));
end $$;
grant execute on function public.my_wallet() to authenticated;

-- pedir un retiro (cuando quiera, desde el mínimo)
create or replace function public.request_usd_withdrawal(p_usd numeric, p_account text, p_method text default 'binance') returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.profiles; bal numeric; mn numeric := coalesce((public.rewards_cfg()->>'usdMin')::numeric, 1); w public.usd_withdrawals;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into pr from public.profiles where id = auth.uid();
  if pr.banned then raise exception 'Tu cuenta está suspendida'; end if;
  if exists (select 1 from public.usd_withdrawals where user_id = auth.uid() and status = 'pendiente') then
    raise exception 'Ya tienes un retiro en camino. Espera a que te lo paguemos para pedir otro.'; end if;
  p_usd := round(coalesce(p_usd, 0), 2);
  bal := public.usd_balance(auth.uid());
  if p_usd < mn then raise exception 'El retiro mínimo es de US$ %', replace(to_char(mn, 'FM999990.00'), '.', ','); end if;
  if p_usd > bal then raise exception 'Tu saldo es de US$ %', replace(to_char(bal, 'FM999990.00'), '.', ','); end if;
  if char_length(trim(coalesce(p_account, ''))) < 3 then raise exception 'Escribe tu Binance Pay ID o correo de Binance'; end if;
  insert into public.usd_withdrawals (user_id, usd, method, account) values (auth.uid(), p_usd, left(coalesce(p_method, 'binance'), 30), left(trim(p_account), 120))
  returning * into w;
  return to_jsonb(w) - 'user_id';
end $$;
grant execute on function public.request_usd_withdrawal(numeric, text, text) to authenticated;

-- retiros en el chat privado: el alumno te avisa al pedir y recibe tu respuesta al pagar o rechazar
create or replace function public.retiro_al_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text;
begin
  if tg_op = 'INSERT' then
    txt := '💵 Pedí retirar US$ ' || replace(to_char(new.usd, 'FM999990.00'), '.', ',') || ' de mi saldo · ' || initcap(new.method) || ': ' || new.account;
    insert into public.dm_threads (user_id, open) values (new.user_id, true) on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body) values (new.user_id, false, txt);
  elsif tg_op = 'UPDATE' and old.status = 'pendiente' and new.status <> 'pendiente' then
    txt := case when new.status = 'pagado' then '✅ Te envié US$ ' || replace(to_char(new.usd, 'FM999990.00'), '.', ',') || ' a ' || new.account || '. ¡Felicitaciones y sigue jugando!'
      else '❌ Tu retiro de US$ ' || replace(to_char(new.usd, 'FM999990.00'), '.', ',') || ' no se pudo hacer.' || coalesce(' Motivo: ' || nullif(trim(new.admin_note), '') || '.', '')
           || ' El saldo volvió a tu cuenta.' end;
    insert into public.dm_threads (user_id, open) values (new.user_id, true) on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body, notified) values (new.user_id, true, txt, true);
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists retiro_al_chat on public.usd_withdrawals;
create trigger retiro_al_chat after insert or update of status on public.usd_withdrawals
  for each row execute function public.retiro_al_chat();

-- admin: lista de retiros con alertas, y marcar pagado / rechazado
create or replace function public.admin_usd_withdrawals() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return coalesce((select jsonb_agg(x order by (x.status = 'pendiente') desc, x.created_at desc) from (
    select w.id, w.usd, w.method, w.account, w.status, w.admin_note, w.created_at, w.reviewed_at, p.username, p.affiliate,
           public.usd_balance(w.user_id) saldo,
           (select count(distinct y.user_id) from public.usd_withdrawals y where lower(trim(y.account)) = lower(trim(w.account)) and y.user_id <> w.user_id)
         + (select count(distinct y.user_id) from public.redemptions y where lower(trim(y.account)) = lower(trim(w.account)) and y.user_id <> w.user_id) dup_account,
           (select count(distinct e2.user_id) from public.challenge_entries e1 join public.challenge_entries e2 on e2.ip_hash = e1.ip_hash and e2.user_id <> e1.user_id
              where e1.user_id = w.user_id and e1.ip_hash <> '') dup_ip
    from public.usd_withdrawals w join public.profiles p on p.id = w.user_id
    order by w.created_at desc limit 300) x), '[]'::jsonb);
end $$;
grant execute on function public.admin_usd_withdrawals() to authenticated;

create or replace function public.admin_review_usd_withdrawal(p_id uuid, p_status text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if p_status not in ('pagado', 'rechazado') then raise exception 'Estado inválido'; end if;
  update public.usd_withdrawals set status = p_status, admin_note = left(coalesce(p_note, ''), 300), reviewed_at = now()
  where id = p_id and status = 'pendiente';
end $$;
grant execute on function public.admin_review_usd_withdrawal(uuid, text, text) to authenticated;

-- lista de retos para los alumnos: ahora dice si es express, el premio y lo que ganó
drop function if exists public.challenges_feed();
create function public.challenges_feed() returns table(id uuid, title text, kind text, question text, options jsonb, market text, chart_t bigint, side text, image_url text,
  points int, max_winners int, starts_at timestamptz, ends_at timestamptz, winners int, closed boolean,
  my_correct boolean, my_place int, my_points int, answered boolean, correct int, zone numeric, tol numeric, explain text, weekly boolean,
  bars jsonb, after_bars jsonb, decimals int, my_answer jsonb, players int, express boolean, prize_usd numeric, my_usd numeric)
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
    c.decimals, e.answer, w.p::int, c.express, c.prize_usd, case when x.done then e.usd end
  from public.challenges c
  cross join lateral (select public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) cl) x0
  cross join lateral (select x0.cl, x0.cl <= now() done) x
  left join public.challenge_keys k on k.challenge_id = c.id
  left join public.challenge_entries e on e.challenge_id = c.id and e.user_id = auth.uid()
  cross join lateral (select count(*) filter (where y.place is not null) n, count(*) p from public.challenge_entries y where y.challenge_id = c.id) w
  where c.status = 'publicado' and c.starts_at <= now() and c.starts_at > now() - interval '45 days'
  order by (c.express and x0.cl > now()) desc, c.weekly desc, c.starts_at desc limit 40
$$;
grant execute on function public.challenges_feed() to anon, authenticated;

-- avisos al celular: el reto express dice el premio en dólares
drop function if exists public.reto_push_claim();
create function public.reto_push_claim() returns table(id uuid, what text, title text, points int, max_winners int, close_at timestamptz, weekly boolean, prize_usd numeric)
language plpgsql security definer set search_path = public as $$
declare res boolean := coalesce((public.rewards_cfg()->>'pushResults')::boolean, true);
begin
  return query
    with n as (update public.challenges c set notified_at = now()
               where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now() returning c.*)
    select n.id, 'nuevo'::text, n.title, n.points, n.max_winners, public.challenge_close_at(n.starts_at, n.ends_at, n.weekly or n.express), n.weekly,
           case when n.express then n.prize_usd else 0 end
    from n where n.notify and n.starts_at > now() - interval '2 hours';
  return query
    with r as (update public.challenges c set results_notified_at = now()
               where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) <= now() returning c.*)
    select r.id, 'resultados'::text, r.title, r.points, r.max_winners, public.challenge_close_at(r.starts_at, r.ends_at, r.weekly or r.express), r.weekly,
           case when r.express then r.prize_usd else 0 end
    from r where res and r.notify and public.challenge_close_at(r.starts_at, r.ends_at, r.weekly or r.express) > now() - interval '2 hours'
      and exists (select 1 from public.challenge_entries e where e.challenge_id = r.id);
end $$;
revoke execute on function public.reto_push_claim() from public, anon, authenticated;
grant execute on function public.reto_push_claim() to service_role;
