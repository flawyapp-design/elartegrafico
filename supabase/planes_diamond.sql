-- =====================================================================
-- Plan Diamond 💎: acceso a todo. Correr DESPUÉS de planes_cursos.sql. Se puede correr varias veces.
--  - Nueva placa "diamond" (por encima de Oro): todos los cursos, Sala Oro, todas las
--    publicaciones exclusivas, doble XP y la ruleta diaria.
--  - La ruleta diaria pasa a ser solo de Diamond (Oro ya no la tiene).
--  - Cada plan de Admin → Sitio → Planes puede llevar su placa: "Nombre | días | precio | diamond".
--    El plan de 100 USDT queda marcado como Diamond.
-- =====================================================================
alter table public.profiles drop constraint if exists profiles_plan_chk;
alter table public.profiles add constraint profiles_plan_chk check (plan in ('','cobre','plata','oro','diamond'));
alter table public.posts drop constraint if exists posts_min_plan_chk;
alter table public.posts add constraint posts_min_plan_chk check (min_plan in ('','cobre','plata','oro','diamond'));

create or replace function public.plan_num(p text) returns int language sql immutable as $$
  select case p when 'diamond' then 4 when 'oro' then 3 when 'plata' then 2 when 'cobre' then 1 else 0 end $$;

-- 0 = sin suscripción … 4 = diamond (el admin cuenta como diamond)
create or replace function public.plan_rank() returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 4
              when not public.is_premium() then 0
              else greatest(1, coalesce((select public.plan_num(plan) from public.profiles where id = auth.uid()), 1)) end
$$;
grant execute on function public.plan_rank() to anon, authenticated;

-- el plan de 100 USDT es el Diamond
update public.site_settings s set data = jsonb_set(s.data, '{plans}', (
    select jsonb_agg(case when not (x ? 'tier') and (x->>'price') ~ '^\s*100(\D|$)' then x || '{"tier":"diamond"}'::jsonb else x end order by o)
    from jsonb_array_elements(s.data->'plans') with ordinality t(x, o)))
where s.id = 1 and jsonb_typeof(s.data->'plans') = 'array' and jsonb_array_length(s.data->'plans') > 0;

-- aprobar un pago: la placa viene del plan
drop function if exists public.review_payment(uuid, boolean, int, text);
create function public.review_payment(pid uuid, approve boolean, p_days int default null, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.payment_requests; d int; hasta timestamptz; cur public.profiles; np text;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select * into r from public.payment_requests where id = pid for update;
  if not found then raise exception 'El pago no existe'; end if;
  if r.status <> 'pendiente' then raise exception 'Este pago ya fue revisado'; end if;
  if approve and r.course_id is not null then
    insert into public.user_courses (user_id, course_id, source) values (r.user_id, r.course_id, 'pago') on conflict do nothing;
    update public.payment_requests set status = 'aprobado', admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
    return jsonb_build_object('status', 'aprobado', 'course_id', r.course_id);
  elsif approve then
    d := coalesce(p_days, r.days);
    if d < 1 or d > 3650 then raise exception 'Días no válidos'; end if;
    select * into cur from public.profiles where id = r.user_id;
    -- la placa sale del plan elegido (Admin → Sitio → Planes); si no tiene, de los días
    np := coalesce((select nullif(lower(x->>'tier'), '') from public.site_settings st, jsonb_array_elements(coalesce(st.data->'plans', '[]'::jsonb)) x
                    where st.id = 1 and x->>'name' = r.plan and lower(x->>'tier') in ('cobre','plata','oro','diamond') limit 1), public.plan_of_days(d));
    -- si ya tiene un plan mayor y sigue activo, se queda con el mayor
    if cur.premium_until is not null and cur.premium_until > now() and public.plan_num(cur.plan) > public.plan_num(np) then np := cur.plan; end if;
    update public.profiles
       set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => d), plan = np
     where id = r.user_id returning premium_until into hasta;
    update public.payment_requests set status = 'aprobado', days = d, admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
    return jsonb_build_object('status', 'aprobado', 'premium_until', hasta, 'plan', np);
  else
    update public.payment_requests set status = 'rechazado', admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
    return jsonb_build_object('status', 'rechazado');
  end if;
end $$;
grant execute on function public.review_payment(uuid, boolean, int, text) to authenticated;

-- ruleta: solo Diamond
create or replace function public.spin_roulette() returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Bogota')::date; x numeric := random(); pz text; amt int := 0; lb text; med text[] := array['trebol','herradura','estrella','cometa','diamante'];
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if public.plan_rank() < 4 then raise exception 'La ruleta diaria es exclusiva del plan Diamond'; end if;
  perform pg_advisory_xact_lock(hashtext('ruleta:' || auth.uid()::text));
  if exists (select 1 from public.roulette_spins where user_id = auth.uid() and day = d) then raise exception 'Ya giraste hoy. Vuelve mañana'; end if;
  if x < 0.32 then pz := 'xp'; amt := 50; lb := '+50 XP';
  elsif x < 0.55 then pz := 'xp'; amt := 100; lb := '+100 XP';
  elsif x < 0.67 then pz := 'xp'; amt := 250; lb := '+250 XP';
  elsif x < 0.74 then pz := 'xp'; amt := 500; lb := '+500 XP';
  elsif x < 0.95 then pz := 'medalla'; lb := med[1 + floor(random() * array_length(med,1))::int];
  else pz := 'dia'; amt := 1; lb := '+1 día de suscripción';
    update public.profiles set premium_until = greatest(coalesce(premium_until, now()), now()) + interval '1 day' where id = auth.uid() and not public.is_admin();
  end if;
  insert into public.roulette_spins (user_id, day, prize, amount, label) values (auth.uid(), d, pz, amt, lb);
  return jsonb_build_object('prize', pz, 'amount', amt, 'label', lb, 'day', d);
end $$;
grant execute on function public.spin_roulette() to authenticated;
