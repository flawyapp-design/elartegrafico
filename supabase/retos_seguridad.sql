-- =====================================================================
-- Retos: protección contra trampas. Correr DESPUÉS de retos.sql y retos_logros.sql.
-- Se puede correr varias veces.
--  1) Las gráficas de los retos prácticos se guardan con precios y fechas desplazados:
--     no se pueden buscar en el historial ni en los archivos de datos de la página.
--     La tabla de retos ya no se puede leer directo (solo con challenges_feed).
--  2) La respuesta correcta y la explicación solo se muestran cuando el reto CIERRA
--     (antes se mostraban apenas respondías, y alguien podía pasarlas a otra cuenta).
--  3) Las cuentas creadas después de publicado un reto pueden jugarlo, pero no suman puntos.
--  4) Una cuenta de Binance solo puede cobrar para un usuario.
--  5) Admin ve alertas en los canjes: misma cuenta de Binance o misma conexión que otras cuentas.
-- =====================================================================

alter table public.challenges add column if not exists bars jsonb;          -- velas visibles [[t,o,h,l,c],…] ya desplazadas
alter table public.challenges add column if not exists after_bars jsonb;    -- lo que pasó después (se muestra al cerrar)
alter table public.challenges add column if not exists decimals int not null default 2;
alter table public.challenges add column if not exists off numeric not null default 0;  -- desplazamiento de precio aplicado
alter table public.challenge_entries add column if not exists ip_hash text not null default '';

-- solo admin lee la tabla directa; los alumnos usan challenges_feed()
drop policy if exists "retos: ver publicados" on public.challenges;
create policy "retos: ver publicados" on public.challenges for select using (public.is_admin());

-- huella de la conexión (no se guarda la IP, solo un código)
create or replace function public.req_ip_hash() returns text
language plpgsql stable as $$
declare h text; ip text;
begin
  begin h := current_setting('request.headers', true); exception when others then h := null; end;
  if h is null or h = '' then return ''; end if;
  ip := trim(split_part(coalesce((h::json)->>'x-forwarded-for', (h::json)->>'x-real-ip', ''), ',', 1));
  if ip = '' then return ''; end if;
  return substr(md5('eag:' || ip), 1, 16);
end $$;
revoke execute on function public.req_ip_hash() from public, anon, authenticated;

-- responder un reto
create or replace function public.submit_challenge(p_id uuid, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.challenges; k public.challenge_keys; cfg jsonb := public.rewards_cfg(); pr public.profiles;
  ok boolean := false; wins int; pl int; pts int := 0; v numeric; born timestamptz; why text := null;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para participar'; end if;
  if not coalesce((cfg->>'enabled')::boolean, false) then raise exception 'Los retos todavía no están activos'; end if;
  select * into pr from public.profiles where id = auth.uid();
  if pr.banned then raise exception 'Tu cuenta está suspendida'; end if;
  select * into c from public.challenges where id = p_id for update;
  if not found or c.status <> 'publicado' or c.starts_at > now() then raise exception 'Ese reto no está disponible'; end if;
  if c.ends_at <= now() then raise exception 'Este reto ya cerró'; end if;
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
  return jsonb_build_object('correct', ok, 'place', pl, 'points', pts, 'affiliate', pr.affiliate, 'reason', why,
    'full_points', c.points, 'winners_left', greatest(0, c.max_winners - wins - case when pl is not null then 1 else 0 end));
end $$;
grant execute on function public.submit_challenge(uuid, jsonb) to authenticated;

-- lista de retos: la respuesta solo cuando cierra; gráficas desplazadas
drop function if exists public.challenges_feed();
create function public.challenges_feed() returns table(id uuid, title text, kind text, question text, options jsonb, market text, chart_t bigint, side text, image_url text,
  points int, max_winners int, starts_at timestamptz, ends_at timestamptz, winners int, closed boolean,
  my_correct boolean, my_place int, my_points int, answered boolean, correct int, zone numeric, tol numeric, explain text, weekly boolean,
  bars jsonb, after_bars jsonb, decimals int, my_answer jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.kind, c.question, c.options, c.market, null::bigint, c.side, c.image_url, c.points, c.max_winners, c.starts_at, c.ends_at,
    w.n::int, (c.ends_at <= now() or w.n >= c.max_winners),
    e.correct, e.place, e.points, e.id is not null,
    case when c.ends_at <= now() or w.n >= c.max_winners then k.correct end,
    case when c.ends_at <= now() or w.n >= c.max_winners then k.zone + coalesce(c.off, 0) end,
    case when c.ends_at <= now() or w.n >= c.max_winners then k.tol end,
    case when c.ends_at <= now() or w.n >= c.max_winners then k.explain end,
    c.weekly, c.bars,
    case when c.ends_at <= now() or w.n >= c.max_winners then c.after_bars end,
    c.decimals, e.answer
  from public.challenges c
  left join public.challenge_keys k on k.challenge_id = c.id
  left join public.challenge_entries e on e.challenge_id = c.id and e.user_id = auth.uid()
  cross join lateral (select count(*) n from public.challenge_entries x where x.challenge_id = c.id and x.place is not null) w
  where c.status = 'publicado' and c.starts_at <= now() and c.starts_at > now() - interval '45 days'
  order by c.weekly desc, c.starts_at desc limit 40
$$;
grant execute on function public.challenges_feed() to anon, authenticated;

-- canje: una cuenta de Binance por usuario
create or replace function public.request_redemption(p_points int, p_method text, p_account text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.rewards_cfg(); bal int; rate numeric; mn int; r public.redemptions; acc text := lower(trim(coalesce(p_account,'')));
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if not coalesce((cfg->>'enabled')::boolean, false) or not coalesce((cfg->>'redeemOpen')::boolean, false) then
    raise exception 'Los canjes están cerrados por ahora. Tus puntos se siguen acumulando.'; end if;
  if char_length(acc) < 3 then raise exception 'Escribe tu Binance Pay ID o tu correo de Binance'; end if;
  if exists (select 1 from public.redemptions where user_id = auth.uid() and status = 'pendiente') then raise exception 'Ya tienes un canje en revisión'; end if;
  if exists (select 1 from public.redemptions where lower(trim(account)) = acc and user_id <> auth.uid() and status <> 'rechazado') then
    raise exception 'Esa cuenta de Binance ya la usa otro usuario. Cada persona cobra en su propia cuenta.'; end if;
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

-- canjes para admin, con alertas
drop function if exists public.admin_redemptions();
create function public.admin_redemptions() returns table(id uuid, user_id uuid, username text, email text, affiliate boolean, points int, usd numeric, method text, account text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz, balance int,
  dup_account int, dup_ip int, account_age_days int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select r.id, r.user_id, p.username, u.email::text, p.affiliate, r.points, r.usd, r.method, r.account, r.status, r.admin_note, r.created_at, r.reviewed_at, public.reward_balance(r.user_id),
      (select count(distinct x.user_id) from public.redemptions x where lower(trim(x.account)) = lower(trim(r.account)) and x.user_id <> r.user_id)::int,
      (select count(distinct e2.user_id) from public.challenge_entries e1 join public.challenge_entries e2 on e2.ip_hash = e1.ip_hash and e2.user_id <> e1.user_id
         where e1.user_id = r.user_id and e1.ip_hash <> '')::int,
      extract(day from now() - u.created_at)::int
    from public.redemptions r join public.profiles p on p.id = r.user_id join auth.users u on u.id = r.user_id
    order by (r.status = 'pendiente') desc, r.created_at desc limit 500;
end $$;
grant execute on function public.admin_redemptions() to authenticated;

-- respuestas de un reto para admin, con la marca de conexión compartida
drop function if exists public.admin_challenge_entries(uuid);
create function public.admin_challenge_entries(p_id uuid) returns table(username text, country text, affiliate boolean, correct boolean, place int, points int, answer jsonb, created_at timestamptz, same_ip int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.username, p.country, e.affiliate, e.correct, e.place, e.points, e.answer, e.created_at,
      (select count(*) from public.challenge_entries x where x.challenge_id = p_id and x.ip_hash <> '' and x.ip_hash = e.ip_hash and x.user_id <> e.user_id)::int
    from public.challenge_entries e join public.profiles p on p.id = e.user_id where e.challenge_id = p_id order by e.created_at limit 1000;
end $$;
grant execute on function public.admin_challenge_entries(uuid) to authenticated;
