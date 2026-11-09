-- =====================================================================
--  EL ARTE GRÁFICO ACADEMY — base de datos (Supabase / PostgreSQL)
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
--  Se puede ejecutar varias veces (es idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- PERFILES (uno por usuario registrado) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null check (username ~ '^[A-Za-z0-9_.]{3,24}$'),
  role          text not null default 'user' check (role in ('user','admin')),
  premium_until timestamptz,
  demo_used     int not null default 0,
  banned        boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- crea el perfil al registrarse (el username viene en los metadatos del registro)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text;
begin
  u := coalesce(nullif(new.raw_user_meta_data->>'username',''), 'alumno_' || substr(new.id::text,1,8));
  if exists (select 1 from public.profiles where lower(username)=lower(u)) then
    u := u || '_' || substr(new.id::text,1,4);
  end if;
  insert into public.profiles(id, username) values (new.id, u);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and not banned)
$$;
create or replace function public.is_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(select 1 from public.profiles
    where id = auth.uid() and not banned and premium_until is not null and premium_until > now())
$$;

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "admin edita perfiles" on public.profiles;
create policy "admin edita perfiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- ¿está libre el nombre de usuario? (se usa en el registro)
create or replace function public.username_available(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists(select 1 from public.profiles where lower(username) = lower(u))
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- AJUSTES DEL SITIO ----------
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "todos leen ajustes" on public.site_settings;
create policy "todos leen ajustes" on public.site_settings for select using (true);
drop policy if exists "admin ajustes" on public.site_settings;
create policy "admin ajustes" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

-- ---------- BANNERS / SLIDES ----------
create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  place text not null default 'home' check (place in ('home','login')),
  title text not null default '',
  body text not null default '',
  image_url text not null default '',
  cta_text text not null default '',
  cta_link text not null default '',
  sort int not null default 1,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.slides enable row level security;
drop policy if exists "todos leen slides" on public.slides;
create policy "todos leen slides" on public.slides for select using (active or public.is_admin());
drop policy if exists "admin slides" on public.slides;
create policy "admin slides" on public.slides for all using (public.is_admin()) with check (public.is_admin());

-- ---------- MÓDULOS Y LECCIONES ----------
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null, descr text not null default '', level text not null default '',
  sort int not null default 1, status text not null default 'borrador' check (status in ('borrador','publicado')),
  locked boolean not null default true, created_at timestamptz default now()
);
alter table public.modules add column if not exists category text not null default 'Fundamentos';
alter table public.modules enable row level security;
drop policy if exists "leer modulos" on public.modules;
create policy "leer modulos" on public.modules for select using (status = 'publicado' or public.is_admin());
drop policy if exists "admin modulos" on public.modules;
create policy "admin modulos" on public.modules for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null, sort int not null default 1,
  status text not null default 'borrador' check (status in ('borrador','publicado')),
  video_url text not null default '', body text not null default '', min_score int not null default 80,
  created_at timestamptz default now()
);
alter table public.lessons enable row level security;
-- títulos visibles para todos; el contenido se pide por la función get_lesson (premium)
drop policy if exists "leer lecciones" on public.lessons;
create policy "leer lecciones" on public.lessons for select using (public.is_premium() and (status='publicado' or public.is_admin()));
drop policy if exists "admin lecciones" on public.lessons;
create policy "admin lecciones" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

-- índice público de lecciones (sin contenido) para mostrar el temario a todos
create or replace function public.lesson_index() returns table(id uuid, module_id uuid, title text, sort int, has_video boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.module_id, l.title, l.sort, (l.video_url <> '') from public.lessons l
  join public.modules m on m.id = l.module_id
  where (l.status='publicado' and m.status='publicado') or public.is_admin()
  order by m.sort, l.sort
$$;
grant execute on function public.lesson_index() to anon, authenticated;

-- ---------- EJERCICIOS (la parte pública) ----------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade,
  is_demo boolean not null default false,
  sort int not null default 1,
  kind text not null default 'grafica' check (kind in ('grafica','no-operar','calculo','opcion')),
  market text not null default 'B1000',
  t_end bigint not null default 0,          -- última vela visible (unix, UTC)
  side text not null default 'buy' check (side in ('buy','sell')),
  tf_zone text not null default 'H1' check (tf_zone in ('H1','M5')),
  tf_sl text not null default 'M5' check (tf_sl in ('H1','M5','none')),
  reveal_hours int not null default 24,
  tol_pct numeric not null default 0.35,     -- tolerancia en múltiplos del rango medio de la temporalidad
  target_r numeric not null default 2,       -- objetivo de la repetición en R
  prompt text not null default '',
  data jsonb not null default '{}'::jsonb,   -- cálculo: plantilla/variables; opción: lista de opciones (sin marcar cuál es correcta)
  created_at timestamptz default now()
);
alter table public.exercises enable row level security;
drop policy if exists "leer ejercicios" on public.exercises;
create policy "leer ejercicios" on public.exercises for select using (is_demo or public.is_premium());
drop policy if exists "admin ejercicios" on public.exercises;
create policy "admin ejercicios" on public.exercises for all using (public.is_admin()) with check (public.is_admin());

-- ---------- RESPUESTAS (NADIE las lee directo; solo la función de calificar y el admin) ----------
create table if not exists public.exercise_answers (
  exercise_id uuid primary key references public.exercises(id) on delete cascade,
  zone numeric, sl numeric,
  answer jsonb not null default '{}'::jsonb, -- cálculo: fórmula y tolerancia; opción: índice correcto
  explain text not null default ''
);
alter table public.exercise_answers enable row level security;
drop policy if exists "admin respuestas" on public.exercise_answers;
create policy "admin respuestas" on public.exercise_answers for all using (public.is_admin()) with check (public.is_admin());

-- Califica: devuelve la respuesta correcta SOLO cuando el alumno ya respondió.
-- Premium: sin límite. Gratis: solo ejercicios demo y máximo 5 intentos en total.
create or replace function public.grade_exercise(ex uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.exercises; a public.exercise_answers; used int; prem boolean;
begin
  if auth.uid() is null then return jsonb_build_object('error','login'); end if;
  select * into e from public.exercises where id = ex;
  if not found then return jsonb_build_object('error','no_existe'); end if;
  prem := public.is_premium();
  if not prem then
    if not e.is_demo then return jsonb_build_object('error','premium'); end if;
    select demo_used into used from public.profiles where id = auth.uid() for update;
    if coalesce(used,0) >= 5 then return jsonb_build_object('error','demo_agotado'); end if;
    update public.profiles set demo_used = coalesce(used,0) + 1 where id = auth.uid();
  end if;
  select * into a from public.exercise_answers where exercise_id = ex;
  return jsonb_build_object('zone', a.zone, 'sl', a.sl, 'answer', coalesce(a.answer,'{}'::jsonb), 'explain', coalesce(a.explain,''),
    'demo_left', case when prem then null else 5 - (select demo_used from public.profiles where id = auth.uid()) end);
end $$;
grant execute on function public.grade_exercise(uuid) to authenticated;

-- ---------- PROGRESO Y RANKING ----------
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp int not null default 0, data jsonb not null default '{}'::jsonb, updated_at timestamptz default now()
);
alter table public.progress enable row level security;
drop policy if exists "progreso propio" on public.progress;
create policy "progreso propio" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin lee progreso" on public.progress;
create policy "admin lee progreso" on public.progress for select using (public.is_admin());

create or replace function public.leaderboard() returns table(username text, xp int, lessons int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.username, g.xp, coalesce((select count(*) from jsonb_each(g.data->'done') d where (d.value->>'passed')::boolean),0)::int, g.user_id = auth.uid()
  from public.progress g join public.profiles p on p.id = g.user_id
  where not p.banned order by g.xp desc limit 50
$$;
grant execute on function public.leaderboard() to authenticated;

-- ---------- NOTICIAS / COMUNIDAD ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null default '', image_url text not null default '',
  category text not null default 'Noticia', pinned boolean not null default false,
  premium_only boolean not null default false, allow_comments boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "leer posts" on public.posts;
create policy "leer posts" on public.posts for select using (not premium_only or public.is_premium());
drop policy if exists "admin posts" on public.posts;
create policy "admin posts" on public.posts for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
drop policy if exists "leer comentarios" on public.comments;
create policy "leer comentarios" on public.comments for select using (auth.uid() is not null);
drop policy if exists "premium comenta" on public.comments;
create policy "premium comenta" on public.comments for insert with check (user_id = auth.uid() and public.is_premium()
  and exists(select 1 from public.posts p where p.id = post_id and p.allow_comments));
drop policy if exists "borrar comentario" on public.comments;
create policy "borrar comentario" on public.comments for delete using (user_id = auth.uid() or public.is_admin());

create or replace function public.post_comments(pid uuid) returns table(id uuid, body text, created_at timestamptz, username text, mine boolean, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, p.username, c.user_id = auth.uid(), p.role = 'admin'
  from public.comments c join public.profiles p on p.id = c.user_id
  where c.post_id = pid and auth.uid() is not null order by c.created_at
$$;
grant execute on function public.post_comments(uuid) to authenticated;

-- ---------- ADMIN: alumnos ----------
create or replace function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.id, p.username, u.email::text, p.role, p.premium_until, p.demo_used, p.banned, p.created_at, coalesce(g.xp,0)
    from public.profiles p join auth.users u on u.id = p.id left join public.progress g on g.user_id = p.id order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;


-- ---------- OPINIONES (calificación 1-5 y comentario; una por alumno) ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1500),
  approved boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "opinion propia" on public.reviews;
create policy "opinion propia" on public.reviews for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "escribir opinion" on public.reviews;
create policy "escribir opinion" on public.reviews for insert with check (user_id = auth.uid() and approved = false);
drop policy if exists "editar opinion" on public.reviews;
create policy "editar opinion" on public.reviews for update using (user_id = auth.uid() or public.is_admin())
  with check (public.is_admin() or (user_id = auth.uid() and approved = false));
drop policy if exists "borrar opinion" on public.reviews;
create policy "borrar opinion" on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

create or replace function public.public_reviews() returns table(id uuid, rating int, body text, created_at timestamptz, username text, premium boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.body, r.created_at, p.username, (p.premium_until > now())
  from public.reviews r join public.profiles p on p.id = r.user_id
  where r.approved and not p.banned order by r.created_at desc limit 60
$$;
grant execute on function public.public_reviews() to anon, authenticated;

-- ---------- ESTADÍSTICAS ----------
create table if not exists public.page_views (
  id bigserial primary key, sid text not null, path text not null,
  user_id uuid default auth.uid(), created_at timestamptz not null default now()
);
alter table public.page_views enable row level security;
drop policy if exists "registrar visita" on public.page_views;
create policy "registrar visita" on public.page_views for insert with check (char_length(path) <= 80 and char_length(sid) <= 40);
drop policy if exists "admin visitas" on public.page_views;
create policy "admin visitas" on public.page_views for select using (public.is_admin());
create index if not exists page_views_created on public.page_views(created_at);

create table if not exists public.watch_time (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  seconds int not null default 0, updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.watch_time enable row level security;
drop policy if exists "admin video" on public.watch_time;
create policy "admin video" on public.watch_time for select using (public.is_admin() or user_id = auth.uid());

create or replace function public.add_watch(lesson uuid, secs int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or secs <= 0 or secs > 120 then return; end if;
  insert into public.watch_time(user_id, lesson_id, seconds) values (auth.uid(), lesson, secs)
  on conflict (user_id, lesson_id) do update set seconds = public.watch_time.seconds + excluded.seconds, updated_at = now();
end $$;
grant execute on function public.add_watch(uuid, int) to authenticated;

create or replace function public.public_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where not banned),
    'lessons', (select count(*) from public.lessons l join public.modules m on m.id=l.module_id where l.status='publicado' and m.status='publicado'),
    'exercises', (select count(*) from public.exercises),
    'rating', (select round(avg(rating)::numeric,1) from public.reviews where approved),
    'reviews', (select count(*) from public.reviews where approved))
$$;
grant execute on function public.public_stats() to anon, authenticated;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'premium', (select count(*) from public.profiles where premium_until > now()),
    'new7', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new30', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'views7', (select count(*) from public.page_views where created_at > now() - interval '7 days'),
    'views30', (select count(*) from public.page_views where created_at > now() - interval '30 days'),
    'visitors30', (select count(distinct sid) from public.page_views where created_at > now() - interval '30 days'),
    'watch_hours', (select round(coalesce(sum(seconds),0)/3600.0,1) from public.watch_time),
    'exercises_done', (select coalesce(sum((data->'practice'->>'n')::int),0) from public.progress),
    'demo_done', (select coalesce(sum(demo_used),0) from public.profiles),
    'rating', (select round(avg(rating)::numeric,2) from public.reviews where approved),
    'reviews', (select count(*) from public.reviews),
    'reviews_pending', (select count(*) from public.reviews where not approved),
    'comments', (select count(*) from public.comments),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d',d,'views',v,'visitors',u,'signups',s) order by d),'[]'::jsonb) from (
        select g.d::date as d,
          (select count(*) from public.page_views pv where pv.created_at::date = g.d::date) as v,
          (select count(distinct sid) from public.page_views pv where pv.created_at::date = g.d::date) as u,
          (select count(*) from public.profiles pr where pr.created_at::date = g.d::date) as s
        from generate_series(current_date - 29, current_date, interval '1 day') g(d)) x),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('path',path,'n',n) order by n desc),'[]'::jsonb) from (
        select split_part(path,'-',1) as path, count(*) n from public.page_views where created_at > now() - interval '30 days' group by 1 order by 2 desc limit 12) y),
    'top_lessons', (select coalesce(jsonb_agg(jsonb_build_object('title',title,'hours',h) order by h desc),'[]'::jsonb) from (
        select l.title, round(sum(w.seconds)/3600.0,1) h from public.watch_time w join public.lessons l on l.id=w.lesson_id group by l.title order by 2 desc limit 10) z)
  ) into r;
  return r;
end $$;
grant execute on function public.admin_stats() to authenticated;

create or replace function public.admin_reviews() returns table(id uuid, rating int, body text, approved boolean, created_at timestamptz, username text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select r.id, r.rating, r.body, r.approved, r.created_at, p.username from public.reviews r join public.profiles p on p.id=r.user_id order by r.approved, r.created_at desc;
end $$;
grant execute on function public.admin_reviews() to authenticated;

-- ---------- ARCHIVOS (imágenes de banners, noticias, etc.) ----------
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict (id) do nothing;
drop policy if exists "media lectura" on storage.objects;
create policy "media lectura" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media admin sube" on storage.objects;
create policy "media admin sube" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media admin borra" on storage.objects;
create policy "media admin borra" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- =====================================================================
--  DESPUÉS DE REGISTRARTE en la web, conviértete en administrador:

-- ---------- MÓDULOS DISPONIBLES / BLOQUEADOS ----------
alter table public.modules add column if not exists available boolean not null default false;
alter table public.modules add column if not exists open_at timestamptz;
update public.modules set available = true where status = 'publicado' and open_at is null and available = false and title ilike 'Demo%';

create or replace function public.module_open(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.available or (m.open_at is not null and m.open_at <= now()) from public.modules m where m.id = mid), false)
$$;
grant execute on function public.module_open(uuid) to anon, authenticated;

-- las lecciones de un módulo bloqueado no se pueden leer (salvo el administrador)
drop policy if exists "leer lecciones" on public.lessons;
create policy "leer lecciones" on public.lessons for select
  using (public.is_admin() or (public.is_premium() and status = 'publicado' and public.module_open(module_id)));

-- ---------- INGRESO CON USUARIO (con límite de intentos) ----------
create table if not exists public.login_attempts (id bigserial primary key, uname text not null, ok boolean not null, at timestamptz not null default now());
create index if not exists login_attempts_u on public.login_attempts (lower(uname), at desc);
alter table public.login_attempts enable row level security;   -- nadie la lee desde la web

create or replace function public.login_email(u text, pw text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare e text; h text; fails int;
begin
  select count(*) into fails from public.login_attempts
   where lower(uname) = lower(trim(u)) and not ok and at > now() - interval '15 minutes';
  if fails >= 8 then raise exception 'Demasiados intentos. Espera 15 minutos o ingresa con tu correo.'; end if;
  select au.email, au.encrypted_password into e, h
    from auth.users au join public.profiles p on p.id = au.id
   where lower(p.username) = lower(trim(u)) limit 1;
  if e is not null and h is not null and extensions.crypt(pw, h) = h then
    insert into public.login_attempts(uname, ok) values (trim(u), true);
    return e;
  end if;
  insert into public.login_attempts(uname, ok) values (trim(u), false);
  delete from public.login_attempts where at < now() - interval '2 days';
  return null;
end $$;
revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;

--    update public.profiles set role = 'admin' where username = 'TU_USUARIO';
-- =====================================================================
-- Foto de perfil, descripción corta y país. Cada usuario edita solo lo suyo.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists country text not null default '';

create or replace function public.update_my_profile(p_avatar text, p_bio text, p_country text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_avatar is not null and p_avatar <> '' and p_avatar not like '%/storage/v1/object/public/avatars/' || auth.uid()::text || '/%' then
    raise exception 'Foto no válida';
  end if;
  update public.profiles set avatar_url = nullif(p_avatar, ''), bio = left(coalesce(p_bio, ''), 160), country = left(coalesce(p_country, ''), 40)
   where id = auth.uid();
end $$;
grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- carpeta de fotos: cada quien sube solo dentro de su carpeta (su id), máximo 2 MB, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "avatars lectura" on storage.objects;
create policy "avatars lectura" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars sube propio" on storage.objects;
create policy "avatars sube propio" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars cambia propio" on storage.objects;
create policy "avatars cambia propio" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars borra propio" on storage.objects;
create policy "avatars borra propio" on storage.objects for delete using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- mostrar la foto en ranking, comentarios, opiniones y lista de alumnos
drop function if exists public.leaderboard();
create function public.leaderboard() returns table(username text, xp int, lessons int, is_me boolean, avatar_url text, country text)
language sql stable security definer set search_path = public as $$
  select p.username, g.xp, coalesce((select count(*) from jsonb_each(g.data->'done') d where (d.value->>'passed')::boolean),0)::int, g.user_id = auth.uid(), p.avatar_url, p.country
  from public.progress g join public.profiles p on p.id = g.user_id
  where not p.banned order by g.xp desc limit 50
$$;
grant execute on function public.leaderboard() to authenticated;

drop function if exists public.post_comments(uuid);
create function public.post_comments(pid uuid) returns table(id uuid, body text, created_at timestamptz, username text, mine boolean, is_admin boolean, avatar_url text)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, p.username, c.user_id = auth.uid(), p.role = 'admin', p.avatar_url
  from public.comments c join public.profiles p on p.id = c.user_id
  where c.post_id = pid and auth.uid() is not null order by c.created_at
$$;
grant execute on function public.post_comments(uuid) to authenticated;

drop function if exists public.public_reviews();
create function public.public_reviews() returns table(id uuid, rating int, body text, created_at timestamptz, username text, premium boolean, avatar_url text)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.body, r.created_at, p.username, (p.premium_until > now()), p.avatar_url
  from public.reviews r join public.profiles p on p.id = r.user_id
  where r.approved and not p.banned order by r.created_at desc limit 60
$$;
grant execute on function public.public_reviews() to anon, authenticated;

drop function if exists public.admin_users();
create function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int, avatar_url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.id, p.username, u.email::text, p.role, p.premium_until, p.demo_used, p.banned, p.created_at, coalesce(g.xp,0), p.avatar_url
    from public.profiles p join auth.users u on u.id = p.id left join public.progress g on g.user_id = p.id order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;
