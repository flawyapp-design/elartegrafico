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
drop function if exists public.lesson_index();
create function public.lesson_index() returns table(id uuid, module_id uuid, title text, sort int, has_video boolean)
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

drop function if exists public.leaderboard();
create function public.leaderboard() returns table(username text, xp int, lessons int, is_me boolean)
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

drop function if exists public.post_comments(uuid);
create function public.post_comments(pid uuid) returns table(id uuid, body text, created_at timestamptz, username text, mine boolean, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, p.username, c.user_id = auth.uid(), p.role = 'admin'
  from public.comments c join public.profiles p on p.id = c.user_id
  where c.post_id = pid and auth.uid() is not null order by c.created_at
$$;
grant execute on function public.post_comments(uuid) to authenticated;

-- ---------- ADMIN: alumnos ----------
drop function if exists public.admin_users();
create function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int)
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

drop function if exists public.public_reviews();
create function public.public_reviews() returns table(id uuid, rating int, body text, created_at timestamptz, username text, premium boolean)
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

drop function if exists public.admin_reviews();
create function public.admin_reviews() returns table(id uuid, rating int, body text, approved boolean, created_at timestamptz, username text)
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

-- mostrar la foto en ranking, comentarios, opiniones y lista de alumnos (ranking público con placa premium)
drop function if exists public.leaderboard();
create function public.leaderboard() returns table(username text, xp int, lessons int, is_me boolean, avatar_url text, country text, premium boolean)
language sql stable security definer set search_path = public as $$
  select p.username, g.xp,
         coalesce((select count(*) from jsonb_each(g.data->'done') d where (d.value->>'passed')::boolean),0)::int,
         coalesce(g.user_id = auth.uid(), false), p.avatar_url, p.country,
         coalesce(p.premium_until > now(), false)
  from public.progress g join public.profiles p on p.id = g.user_id
  where not p.banned and p.role <> 'admin' and g.xp > 0
  order by g.xp desc limit 100
$$;
grant execute on function public.leaderboard() to anon, authenticated;

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
create function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int, avatar_url text, country text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.id, p.username, u.email::text, p.role, p.premium_until, p.demo_used, p.banned, p.created_at, coalesce(g.xp,0), p.avatar_url, p.country
    from public.profiles p join auth.users u on u.id = p.id left join public.progress g on g.user_id = p.id order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;


alter table public.modules add column if not exists ask_feedback boolean not null default true;

create table if not exists public.module_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  liked text not null check (char_length(liked) between 3 and 1500),
  improve text not null check (char_length(improve) between 3 and 1500),
  created_at timestamptz not null default now(),
  unique (user_id, module_id)
);
create index if not exists module_feedback_mod_idx on public.module_feedback (module_id, created_at desc);
alter table public.module_feedback enable row level security;

drop policy if exists "reseñas: ver las propias" on public.module_feedback;
create policy "reseñas: ver las propias" on public.module_feedback for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "reseñas: dejar la propia" on public.module_feedback;
create policy "reseñas: dejar la propia" on public.module_feedback for insert
  with check (user_id = auth.uid());
drop policy if exists "reseñas: admin" on public.module_feedback;
create policy "reseñas: admin" on public.module_feedback for all
  using (public.is_admin()) with check (public.is_admin());

-- lista para el admin (con usuario, país y módulo)
drop function if exists public.admin_module_feedback();
create function public.admin_module_feedback() returns table(id uuid, module_id uuid, module_title text, username text, country text,
  premium boolean, rating int, liked text, improve text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select f.id, f.module_id, m.title, p.username, p.country, coalesce(p.premium_until > now(), false),
    f.rating, f.liked, f.improve, f.created_at
  from public.module_feedback f join public.profiles p on p.id = f.user_id join public.modules m on m.id = f.module_id
  order by f.created_at desc limit 1000;
end $$;
grant execute on function public.admin_module_feedback() to authenticated;
-- Notificaciones push (app instalable). Correr una vez en SQL Editor.
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  ua text not null default '',
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "suscripcion propia" on public.push_subs;
create policy "suscripcion propia" on public.push_subs for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "borrar suscripcion propia" on public.push_subs;
create policy "borrar suscripcion propia" on public.push_subs for delete using (user_id = auth.uid());

create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text, p_ua text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Suscripción no válida'; end if;
  insert into public.push_subs(endpoint, user_id, p256dh, auth, ua) values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_ua,''), 200))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua;
end $$;
grant execute on function public.save_push_sub(text, text, text, text) to authenticated;

-- llaves VAPID: las genera la función send-push la primera vez. Nadie las lee desde la web (sin políticas).
create table if not exists public.push_config (id int primary key default 1 check (id = 1), public_key text not null, private_key text not null);
alter table public.push_config enable row level security;
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$ select public_key from public.push_config where id = 1 $$;
grant execute on function public.push_public_key() to anon, authenticated;

drop function if exists public.admin_push_stats();
create function public.admin_push_stats() returns table(total int, premium int, gratis int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select count(distinct s.user_id)::int,
    count(distinct s.user_id) filter (where p.premium_until > now())::int,
    count(distinct s.user_id) filter (where p.premium_until is null or p.premium_until <= now())::int
  from public.push_subs s join public.profiles p on p.id = s.user_id where not p.banned;
end $$;
grant execute on function public.admin_push_stats() to authenticated;

-- Cada reinicio sube la "versión" del progreso (rv). Si un alumno tenía la página abierta,
-- su navegador ya no puede volver a subir los datos viejos: el servidor los ignora.

create or replace function public.progress_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if coalesce((new.data->>'rv')::int, 0) < coalesce((old.data->>'rv')::int, 0) then
    return null;            -- datos de antes del reinicio: se ignoran
  end if;
  return new;
end $$;
drop trigger if exists progress_guard on public.progress;
create trigger progress_guard before update on public.progress
  for each row execute function public.progress_guard();

-- p_user: un alumno (o null = TODOS)
-- p_what: 'puntos' (solo puntos, deja las lecciones aprobadas) | 'todo' (lecciones, módulos, puntos, logros, práctica)
-- p_feedback: también borra sus reseñas de módulos · p_demo: también reinicia sus 5 gráficas de prueba gratis
drop function if exists public.admin_reset_progress(uuid, text, boolean, boolean);
create function public.admin_reset_progress(p_user uuid, p_what text, p_feedback boolean default false, p_demo boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if p_what not in ('puntos','todo') then raise exception 'Opción no válida'; end if;
  if p_what = 'puntos' then
    update public.progress g
       set xp = 0,
           data = g.data || jsonb_build_object('xp', 0, 'rv', coalesce((g.data->>'rv')::int, 0) + 1, 'px', '[]'::jsonb),
           updated_at = now()
     where p_user is null or g.user_id = p_user;
  else
    update public.progress g
       set xp = 0, data = jsonb_build_object('rv', coalesce((g.data->>'rv')::int, 0) + 1), updated_at = now()
     where p_user is null or g.user_id = p_user;
  end if;
  get diagnostics n = row_count;
  if p_feedback and to_regclass('public.module_feedback') is not null then
    execute 'delete from public.module_feedback where $1 is null or user_id = $1' using p_user;
  end if;
  if p_demo then
    update public.profiles set demo_used = 0 where p_user is null or id = p_user;
  end if;
  return n;
end $$;
grant execute on function public.admin_reset_progress(uuid, text, boolean, boolean) to authenticated;


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

-- ===== retos_seguridad.sql =====
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

-- ===== videos_noticias.sql =====
-- Videos en las publicaciones de la comunidad. Se puede correr varias veces.
alter table public.posts add column if not exists video_url text not null default '';
-- Los videos subidos desde Admin van al almacenamiento 'media' (hasta 50 MB por archivo en el plan gratis de Supabase).
-- Para videos más pesados, súbelos a Bunny o YouTube y pega el enlace.
