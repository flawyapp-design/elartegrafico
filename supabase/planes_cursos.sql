-- =====================================================================
-- Planes Cobre / Plata / Oro, cursos de por vida, Sala Oro y ruleta diaria Oro.
-- Correr DESPUÉS de pagos.sql (y de prueba_gratis.sql si lo usas). Se puede correr varias veces.
--  - Suscripción (Cobre 1 mes, Plata 6 meses, Oro 12 meses): todos los cursos + zona exclusiva.
--  - Curso suelto: pago único, ese curso de por vida.
--  - Publicaciones por nivel: Todos / Suscriptores / Plata y Oro / Solo Oro (Sala Oro).
--  - Ruleta diaria Oro: un giro gratis al día; nunca se pierde nada (no es apuesta).
-- =====================================================================

-- ---------- cursos ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  descr text not null default '' check (char_length(descr) <= 400),
  color text not null default '#d8b062' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default '🎯' check (char_length(icon) <= 8),
  price text not null default '40 USD' check (char_length(price) <= 30),
  status text not null default 'publicado' check (status in ('borrador','publicado')),
  sort int not null default 1,
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;
drop policy if exists "cursos: leer" on public.courses;
create policy "cursos: leer" on public.courses for select using (status = 'publicado' or public.is_admin());
drop policy if exists "cursos: admin" on public.courses;
create policy "cursos: admin" on public.courses for all using (public.is_admin()) with check (public.is_admin());

insert into public.courses (title, descr, color, icon, sort)
select 'Boom y Crash', 'El método completo de El Arte Gráfico para operar Boom y Crash: estructura, zonas, entradas, stop loss y gestión.', '#e84c5c', '🎯', 1
where not exists (select 1 from public.courses);

alter table public.modules add column if not exists course_id uuid references public.courses(id) on delete set null;
update public.modules set course_id = (select id from public.courses order by sort, created_at limit 1) where course_id is null;

-- cursos comprados (de por vida)
create table if not exists public.user_courses (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  source text not null default 'pago' check (char_length(source) <= 40),
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.user_courses enable row level security;
drop policy if exists "mis cursos" on public.user_courses;
create policy "mis cursos" on public.user_courses for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "cursos de alumnos: admin" on public.user_courses;
create policy "cursos de alumnos: admin" on public.user_courses for all using (public.is_admin()) with check (public.is_admin());

-- ---------- plan del suscriptor ----------
alter table public.profiles add column if not exists plan text not null default '';
alter table public.profiles drop constraint if exists profiles_plan_chk;
alter table public.profiles add constraint profiles_plan_chk check (plan in ('','cobre','plata','oro'));

create or replace function public.plan_of_days(d int) returns text language sql immutable as $$
  select case when d >= 300 then 'oro' when d >= 150 then 'plata' else 'cobre' end $$;
create or replace function public.plan_num(p text) returns int language sql immutable as $$
  select case p when 'oro' then 3 when 'plata' then 2 when 'cobre' then 1 else 0 end $$;

-- 0 = sin suscripción, 1 = cobre, 2 = plata, 3 = oro (el admin cuenta como oro)
create or replace function public.plan_rank() returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 3
              when not public.is_premium() then 0
              else greatest(1, coalesce((select public.plan_num(plan) from public.profiles where id = auth.uid()), 1)) end
$$;
grant execute on function public.plan_rank() to anon, authenticated;

-- ---------- acceso por curso ----------
create or replace function public.course_module_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.modules m join public.user_courses uc on uc.course_id = m.course_id and uc.user_id = auth.uid() where m.id = mid)
$$;
grant execute on function public.course_module_ok(uuid) to authenticated;
create or replace function public.course_lesson_ok(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lessons l where l.id = lid and l.status = 'publicado' and public.course_module_ok(l.module_id))
$$;
grant execute on function public.course_lesson_ok(uuid) to authenticated;

-- prueba gratis (por si no se corrió prueba_gratis.sql)
alter table public.modules add column if not exists free boolean not null default false;
create or replace function public.in_trial() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select greatest(u.created_at, coalesce((select (s.data->>'trialFrom')::timestamptz from public.site_settings s where s.id = 1), u.created_at)) > now() - make_interval(days => greatest(0, coalesce(
             (select (s.data->>'trialDays')::int from public.site_settings s where s.id = 1), 7)))
    from auth.users u join public.profiles p on p.id = u.id
    where u.id = auth.uid() and not p.banned), false)
$$;
grant execute on function public.in_trial() to authenticated;
create or replace function public.trial_module_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.in_trial() and exists (select 1 from public.modules m where m.id = mid and m.free and m.status = 'publicado')
$$;
grant execute on function public.trial_module_ok(uuid) to authenticated;
create or replace function public.trial_lesson_ok(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lessons l where l.id = lid and l.status = 'publicado' and public.trial_module_ok(l.module_id))
$$;
grant execute on function public.trial_lesson_ok(uuid) to authenticated;

drop policy if exists "leer lecciones" on public.lessons;
create policy "leer lecciones" on public.lessons for select
  using (public.is_admin() or (status = 'publicado' and public.module_open(module_id)
         and (public.is_premium() or public.trial_module_ok(module_id) or public.course_module_ok(module_id))));

drop policy if exists "leer ejercicios" on public.exercises;
create policy "leer ejercicios" on public.exercises for select
  using (is_demo or public.is_premium() or (lesson_id is not null and (public.trial_lesson_ok(lesson_id) or public.course_lesson_ok(lesson_id))));

create or replace function public.grade_exercise(ex uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.exercises; a public.exercise_answers; used int; prem boolean; tri boolean := false;
begin
  if auth.uid() is null then return jsonb_build_object('error','login'); end if;
  select * into e from public.exercises where id = ex;
  if not found then return jsonb_build_object('error','no_existe'); end if;
  prem := public.is_premium() or (e.lesson_id is not null and public.course_lesson_ok(e.lesson_id));
  if not prem and e.lesson_id is not null then tri := public.trial_lesson_ok(e.lesson_id); end if;
  if not prem and not tri then
    if not e.is_demo then return jsonb_build_object('error','premium'); end if;
    select demo_used into used from public.profiles where id = auth.uid() for update;
    if coalesce(used,0) >= 5 then return jsonb_build_object('error','demo_agotado'); end if;
    update public.profiles set demo_used = coalesce(used,0) + 1 where id = auth.uid();
  end if;
  select * into a from public.exercise_answers where exercise_id = ex;
  return jsonb_build_object('zone', a.zone, 'sl', a.sl, 'answer', coalesce(a.answer,'{}'::jsonb), 'explain', coalesce(a.explain,''),
    'demo_left', case when prem or tri then null else 5 - (select demo_used from public.profiles where id = auth.uid()) end);
end $$;
grant execute on function public.grade_exercise(uuid) to authenticated;

-- ---------- pagos: plan o curso ----------
alter table public.payment_requests add column if not exists course_id uuid references public.courses(id) on delete set null;

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
    np := public.plan_of_days(d);
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

-- alumnos para admin (con plan y cursos)
drop function if exists public.admin_users();
create function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int, avatar_url text, country text, plan text, courses uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.id, p.username, u.email::text, p.role, p.premium_until, p.demo_used, p.banned, p.created_at, coalesce(g.xp,0), p.avatar_url, p.country, p.plan,
      coalesce((select array_agg(uc.course_id) from public.user_courses uc where uc.user_id = p.id), '{}')
    from public.profiles p join auth.users u on u.id = p.id left join public.progress g on g.user_id = p.id order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;

-- ---------- publicaciones por nivel (zona exclusiva y Sala Oro) ----------
alter table public.posts add column if not exists min_plan text not null default '';
alter table public.posts drop constraint if exists posts_min_plan_chk;
alter table public.posts add constraint posts_min_plan_chk check (min_plan in ('','cobre','plata','oro'));
drop policy if exists "leer posts" on public.posts;
create policy "leer posts" on public.posts for select
  using ((not premium_only and min_plan = '') or public.plan_rank() >= greatest(1, public.plan_num(min_plan)));

-- ---------- ruleta diaria Oro (sin apuestas: nunca se pierde nada) ----------
create table if not exists public.roulette_spins (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  prize text not null,
  amount int not null default 0,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table public.roulette_spins enable row level security;
drop policy if exists "ruleta: ver la propia" on public.roulette_spins;
create policy "ruleta: ver la propia" on public.roulette_spins for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.spin_roulette() returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Bogota')::date; x numeric := random(); pz text; amt int := 0; lb text; med text[] := array['trebol','herradura','estrella','cometa','diamante'];
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if public.plan_rank() < 3 then raise exception 'La ruleta diaria es exclusiva del plan Oro'; end if;
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

-- ---------- retos siempre visibles: se encienden ya (se pueden apagar desde Admin → Ajustes de puntos) ----------
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.site_settings
   set data = data || jsonb_build_object('rewards', coalesce(data->'rewards', '{}'::jsonb) || '{"enabled": true}'::jsonb)
 where id = 1;
