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

-- ===== prueba_gratis.sql =====
-- =====================================================================
-- Prueba gratis: las cuentas gratis ven los módulos marcados como "prueba gratis"
-- (por defecto el de introducción) durante los primeros días desde que se registran
-- (7 por defecto; se cambia en Admin → Pagos). Se puede correr varias veces.
-- =====================================================================

alter table public.modules add column if not exists free boolean not null default false;

-- lanzamiento: las cuentas que ya existen también reciben sus días de prueba, contados desde hoy
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.site_settings set data = data || jsonb_build_object('trialFrom', now()) where id = 1 and not (data ? 'trialFrom');

-- marca el módulo de introducción si todavía no hay ninguno marcado
update public.modules set free = true
where not exists (select 1 from public.modules where free)
  and id = (select id from public.modules where title ilike '%introducci%' or title ilike '%bienvenida%' order by sort limit 1);

-- ¿la cuenta sigue dentro de los días de prueba?
create or replace function public.in_trial() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select greatest(u.created_at, coalesce((select (s.data->>'trialFrom')::timestamptz from public.site_settings s where s.id = 1), u.created_at)) > now() - make_interval(days => greatest(0, coalesce(
             (select (s.data->>'trialDays')::int from public.site_settings s where s.id = 1), 7)))
    from auth.users u join public.profiles p on p.id = u.id
    where u.id = auth.uid() and not p.banned), false)
$$;
grant execute on function public.in_trial() to authenticated;

-- ¿este módulo lo puede ver la cuenta de prueba?
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

-- lecciones: premium, o prueba gratis en un módulo marcado
drop policy if exists "leer lecciones" on public.lessons;
create policy "leer lecciones" on public.lessons for select
  using (public.is_admin() or (status = 'publicado' and public.module_open(module_id)
         and (public.is_premium() or public.trial_module_ok(module_id))));

-- ejercicios: demo, premium, o de una lección de la prueba gratis
drop policy if exists "leer ejercicios" on public.exercises;
create policy "leer ejercicios" on public.exercises for select
  using (is_demo or public.is_premium() or (lesson_id is not null and public.trial_lesson_ok(lesson_id)));

-- calificar: los ejercicios de la prueba gratis no gastan las 5 gráficas de prueba
create or replace function public.grade_exercise(ex uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.exercises; a public.exercise_answers; used int; prem boolean; tri boolean := false;
begin
  if auth.uid() is null then return jsonb_build_object('error','login'); end if;
  select * into e from public.exercises where id = ex;
  if not found then return jsonb_build_object('error','no_existe'); end if;
  prem := public.is_premium();
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

-- ===== afiliados_auto.sql =====
-- =====================================================================
-- Afiliados de Deriv automáticos. Correr DESPUÉS de retos.sql. Se puede correr varias veces.
--  - El admin pega la lista de IDs de sus clientes de Deriv Partners.
--  - Las solicitudes pendientes (o rechazadas) cuyo ID está en la lista se aprueban solas.
--  - Las solicitudes nuevas con un ID de la lista se aprueban al instante.
-- =====================================================================

create table if not exists public.partner_clients (
  deriv_id text primary key,
  added_at timestamptz not null default now()
);
alter table public.partner_clients enable row level security;
drop policy if exists "socios: admin" on public.partner_clients;
create policy "socios: admin" on public.partner_clients for all using (public.is_admin()) with check (public.is_admin());

-- cargar la lista y aprobar a los que coinciden
create or replace function public.admin_partner_import(p_ids text[], p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_add int := 0; n_ok int := 0; ids text[];
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select coalesce(array_agg(distinct x), '{}') into ids
    from (select upper(regexp_replace(coalesce(v,''), '\s', '', 'g')) x from unnest(coalesce(p_ids, '{}')) v) t
    where x ~ '^[A-Z]{1,5}[0-9]{3,12}$' or x ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' or x ~ '^D-[A-Z0-9]{5,10}$';  -- CR1234567 o el ID largo de Deriv Partners
  if p_replace then delete from public.partner_clients; end if;
  insert into public.partner_clients (deriv_id) select unnest(ids) on conflict do nothing;
  get diagnostics n_add = row_count;
  with ok as (
    update public.affiliates a set status = 'verificado', reviewed_at = now(), admin_note = 'Verificado automáticamente con la lista de socios'
    where a.status in ('pendiente','rechazado') and exists (select 1 from public.partner_clients c where c.deriv_id = upper(a.deriv_id))
    returning a.user_id)
  update public.profiles p set affiliate = true from ok where p.id = ok.user_id;
  get diagnostics n_ok = row_count;
  return jsonb_build_object('received', coalesce(array_length(ids,1),0), 'added', n_add, 'approved', n_ok,
    'total', (select count(*) from public.partner_clients));
end $$;
grant execute on function public.admin_partner_import(text[], boolean) to authenticated;

create or replace function public.admin_partner_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return jsonb_build_object('total', (select count(*) from public.partner_clients), 'updated', (select max(added_at) from public.partner_clients));
end $$;
grant execute on function public.admin_partner_info() to authenticated;

-- solicitud del alumno: si el ID ya está en la lista, queda verificado al instante
create or replace function public.request_affiliate(p_deriv text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.affiliates; d text := upper(regexp_replace(coalesce(p_deriv,''), '\s', '', 'g')); inlist boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(d) < 3 or char_length(d) > 40 then raise exception 'Escribe tu ID de cliente de Deriv (ej.: CR1234567)'; end if;
  if exists (select 1 from public.affiliates where upper(deriv_id) = d and user_id <> auth.uid() and status <> 'rechazado') then
    raise exception 'Ese ID de Deriv ya está registrado por otra cuenta'; end if;
  select * into cur from public.affiliates where user_id = auth.uid();
  if found and cur.status = 'verificado' then raise exception 'Ya eres afiliado verificado'; end if;
  inlist := exists (select 1 from public.partner_clients where deriv_id = d);
  insert into public.affiliates (user_id, deriv_id, status, admin_note, created_at, reviewed_at)
  values (auth.uid(), d, case when inlist then 'verificado' else 'pendiente' end,
          case when inlist then 'Verificado automáticamente con la lista de socios' else '' end, now(), case when inlist then now() end)
  on conflict (user_id) do update set deriv_id = excluded.deriv_id, status = excluded.status, admin_note = excluded.admin_note,
    created_at = now(), reviewed_at = excluded.reviewed_at;
  if inlist then update public.profiles set affiliate = true where id = auth.uid(); end if;
  return jsonb_build_object('status', case when inlist then 'verificado' else 'pendiente' end);
end $$;
grant execute on function public.request_affiliate(text) to authenticated;

-- ===== afiliados_auto.sql (listas activa/antigua) =====
-- =====================================================================
-- Afiliados de Deriv automáticos. Correr DESPUÉS de retos.sql. Se puede correr varias veces.
--  - Lista ACTIVA (clientes que operaron este mes): quien envíe un ID de ahí queda verificado solo.
--  - Lista ANTIGUA (meses anteriores): no se aprueba sola; el admin ve "Está en tu lista antigua"
--    y lo autoriza con un clic.
--  - Cada mes el admin pega la lista nueva marcando "lista nueva del mes": los activos que ya
--    no aparecen pasan solos a la lista antigua.
--  - Acepta IDs largos (019c0ed8-…), cortos (d-k3skg7d) y tipo CR1234567.
-- =====================================================================

create table if not exists public.partner_clients (
  deriv_id text primary key,
  added_at timestamptz not null default now()
);
alter table public.partner_clients add column if not exists tier text not null default 'activo';
alter table public.partner_clients add column if not exists seen_at timestamptz not null default now();
alter table public.partner_clients drop constraint if exists partner_clients_tier_chk;
alter table public.partner_clients add constraint partner_clients_tier_chk check (tier in ('activo','antiguo'));
alter table public.partner_clients enable row level security;
drop policy if exists "socios: admin" on public.partner_clients;
create policy "socios: admin" on public.partner_clients for all using (public.is_admin()) with check (public.is_admin());

-- limpiar y validar los IDs pegados
create or replace function public.partner_clean(p_ids text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}')
  from (select upper(regexp_replace(coalesce(v,''), '\s', '', 'g')) x from unnest(coalesce(p_ids, '{}')) v) t
  where x ~ '^[A-Z]{1,5}[0-9]{3,12}$' or x ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' or x ~ '^D-[A-Z0-9]{5,10}$'
$$;

-- cargar una lista. p_tier: 'activo' (se aprueban solos) o 'antiguo' (solo avisa).
-- p_monthly: es la lista nueva del mes -> los activos que no vienen en ella pasan a 'antiguo'.
drop function if exists public.admin_partner_import(text[], boolean);
drop function if exists public.admin_partner_import(text[], boolean, text);
create function public.admin_partner_import(p_ids text[], p_monthly boolean default false, p_tier text default 'activo') returns jsonb
language plpgsql security definer set search_path = public as $$
declare ids text[] := public.partner_clean(p_ids); n_new int := 0; n_old int := 0; n_ok int := 0; t text := case when p_tier = 'antiguo' then 'antiguo' else 'activo' end;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if t = 'activo' and p_monthly then
    update public.partner_clients set tier = 'antiguo' where tier = 'activo' and not (deriv_id = any(ids));
    get diagnostics n_old = row_count;
  end if;
  if t = 'activo' then
    insert into public.partner_clients (deriv_id, tier, seen_at) select unnest(ids), 'activo', now()
    on conflict (deriv_id) do update set tier = 'activo', seen_at = now();
  else
    insert into public.partner_clients (deriv_id, tier, seen_at) select unnest(ids), 'antiguo', now()
    on conflict (deriv_id) do nothing;   -- nunca baja a un activo
  end if;
  get diagnostics n_new = row_count;
  with ok as (
    update public.affiliates a set status = 'verificado', reviewed_at = now(), admin_note = 'Verificado automáticamente con la lista de socios activos'
    where a.status in ('pendiente','rechazado') and exists (select 1 from public.partner_clients c where c.deriv_id = upper(a.deriv_id) and c.tier = 'activo')
    returning a.user_id)
  update public.profiles p set affiliate = true from ok where p.id = ok.user_id;
  get diagnostics n_ok = row_count;
  return jsonb_build_object('received', coalesce(array_length(ids,1),0), 'saved', n_new, 'moved_old', n_old, 'approved', n_ok,
    'active', (select count(*) from public.partner_clients where tier = 'activo'),
    'old', (select count(*) from public.partner_clients where tier = 'antiguo'));
end $$;
grant execute on function public.admin_partner_import(text[], boolean, text) to authenticated;

create or replace function public.admin_partner_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return jsonb_build_object('total', (select count(*) from public.partner_clients),
    'active', (select count(*) from public.partner_clients where tier = 'activo'),
    'old', (select count(*) from public.partner_clients where tier = 'antiguo'),
    'updated', (select max(seen_at) from public.partner_clients where tier = 'activo'));
end $$;
grant execute on function public.admin_partner_info() to authenticated;

-- solicitudes para admin, con la marca de en qué lista está el ID
drop function if exists public.admin_affiliates();
create function public.admin_affiliates() returns table(user_id uuid, username text, email text, country text, deriv_id text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz, in_list text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select a.user_id, p.username, u.email::text, p.country, a.deriv_id, a.status, a.admin_note, a.created_at, a.reviewed_at,
      (select c.tier from public.partner_clients c where c.deriv_id = upper(a.deriv_id))
    from public.affiliates a join public.profiles p on p.id = a.user_id join auth.users u on u.id = a.user_id
    order by (a.status = 'pendiente') desc, a.created_at desc limit 500;
end $$;
grant execute on function public.admin_affiliates() to authenticated;

-- aprobar de una vez a todos los pendientes que están en la lista antigua
create or replace function public.admin_partner_approve_old() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  with ok as (
    update public.affiliates a set status = 'verificado', reviewed_at = now(), admin_note = 'Autorizado por el admin (lista antigua de socios)'
    where a.status = 'pendiente' and exists (select 1 from public.partner_clients c where c.deriv_id = upper(a.deriv_id) and c.tier = 'antiguo')
    returning a.user_id)
  update public.profiles p set affiliate = true from ok where p.id = ok.user_id;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.admin_partner_approve_old() to authenticated;

-- solicitud del alumno: si el ID está en la lista ACTIVA, queda verificado al instante
create or replace function public.request_affiliate(p_deriv text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.affiliates; d text := upper(regexp_replace(coalesce(p_deriv,''), '\s', '', 'g')); act boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(d) < 3 or char_length(d) > 40 then raise exception 'Escribe tu ID de cliente de Deriv'; end if;
  if exists (select 1 from public.affiliates where upper(deriv_id) = d and user_id <> auth.uid() and status <> 'rechazado') then
    raise exception 'Ese ID de Deriv ya está registrado por otra cuenta'; end if;
  select * into cur from public.affiliates where user_id = auth.uid();
  if found and cur.status = 'verificado' then raise exception 'Ya eres afiliado verificado'; end if;
  act := exists (select 1 from public.partner_clients where deriv_id = d and tier = 'activo');
  insert into public.affiliates (user_id, deriv_id, status, admin_note, created_at, reviewed_at)
  values (auth.uid(), d, case when act then 'verificado' else 'pendiente' end,
          case when act then 'Verificado automáticamente con la lista de socios activos' else '' end, now(), case when act then now() end)
  on conflict (user_id) do update set deriv_id = excluded.deriv_id, status = excluded.status, admin_note = excluded.admin_note,
    created_at = now(), reviewed_at = excluded.reviewed_at;
  if act then update public.profiles set affiliate = true where id = auth.uid(); end if;
  return jsonb_build_object('status', case when act then 'verificado' else 'pendiente' end);
end $$;
grant execute on function public.request_affiliate(text) to authenticated;

-- ===== pagos.sql =====
-- ---------- PAGOS POR BINANCE (semiautomático) ----------
-- El alumno registra su pago (ID de orden de Binance Pay); el admin lo revisa en su Binance y lo aprueba con un clic.
-- Aprobar suma los días al premium del alumno (desde hoy o desde su vencimiento, lo que sea mayor).
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  method text not null default 'binance' check (method in ('binance','otro')),
  plan text not null default '' check (char_length(plan) <= 80),
  days int not null default 30 check (days between 1 and 3650),
  amount text not null default '' check (char_length(amount) <= 40),
  order_id text not null check (char_length(order_id) between 4 and 80),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
-- un mismo ID de orden no se puede usar dos veces (salvo que se haya rechazado)
create unique index if not exists payment_requests_order_uq
  on public.payment_requests (method, lower(order_id)) where status <> 'rechazado';
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at desc);
alter table public.payment_requests enable row level security;

drop policy if exists "pagos: ver los propios" on public.payment_requests;
create policy "pagos: ver los propios" on public.payment_requests for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "pagos: registrar el propio" on public.payment_requests;
create policy "pagos: registrar el propio" on public.payment_requests for insert
  with check (user_id = auth.uid() and status = 'pendiente' and admin_note = '' and reviewed_at is null);
drop policy if exists "pagos: admin" on public.payment_requests;
create policy "pagos: admin" on public.payment_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- máximo 3 pagos pendientes por alumno (evita spam)
create or replace function public.payment_requests_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.payment_requests where user_id = new.user_id and status = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 pagos por confirmar. Espera a que los revisemos.';
  end if;
  return new;
end $$;
drop trigger if exists payment_requests_limit on public.payment_requests;
create trigger payment_requests_limit before insert on public.payment_requests
  for each row execute function public.payment_requests_limit();

-- lista para el admin (con usuario y correo)
drop function if exists public.admin_payments();
create function public.admin_payments() returns table(id uuid, user_id uuid, username text, email text, premium_until timestamptz,
  method text, plan text, days int, amount text, order_id text, note text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select r.id, r.user_id, p.username, u.email::text, p.premium_until, r.method, r.plan, r.days, r.amount, r.order_id,
    r.note, r.status, r.admin_note, r.created_at, r.reviewed_at
  from public.payment_requests r join public.profiles p on p.id = r.user_id join auth.users u on u.id = r.user_id
  order by (r.status = 'pendiente') desc, r.created_at desc limit 300;
end $$;
grant execute on function public.admin_payments() to authenticated;

-- aprobar o rechazar (todo en un paso)
drop function if exists public.review_payment(uuid, boolean, int, text);
create function public.review_payment(pid uuid, approve boolean, p_days int default null, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.payment_requests; d int; hasta timestamptz;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select * into r from public.payment_requests where id = pid for update;
  if not found then raise exception 'El pago no existe'; end if;
  if r.status <> 'pendiente' then raise exception 'Este pago ya fue revisado'; end if;
  if approve then
    d := coalesce(p_days, r.days);
    if d < 1 or d > 3650 then raise exception 'Días no válidos'; end if;
    update public.profiles
       set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => d)
     where id = r.user_id returning premium_until into hasta;
    update public.payment_requests set status = 'aprobado', days = d, admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
  else
    update public.payment_requests set status = 'rechazado', admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
  end if;
  return jsonb_build_object('status', case when approve then 'aprobado' else 'rechazado' end, 'premium_until', hasta);
end $$;
grant execute on function public.review_payment(uuid, boolean, int, text) to authenticated;

-- ===== planes_cursos.sql =====
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

-- ===== retos_suspenso.sql =====
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

-- ===== planes_diamond.sql =====
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

-- ===== chat.sql =====
-- =====================================================================
-- Chat privado admin ↔ alumno. Correr DESPUÉS de retos_suspenso.sql. Se puede correr varias veces.
--  - Cada alumno tiene, como mucho, una conversación privada con el admin.
--  - Solo el admin abre conversaciones; el alumno responde mientras esté abierta.
--  - Solo texto. Los mensajes se borran solos a los 10 días (se cambia en "chatDays" de Ajustes).
--  - "Finalizar" borra la conversación al instante.
--  - Notificaciones: al alumno cuando le escribes; a ti cuando te responde (cada minuto, con el
--    mismo aviso automático de los retos).
-- =====================================================================

create table if not exists public.dm_threads (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  open boolean not null default true,
  topic text not null default '',
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.dm_threads(user_id) on delete cascade,
  from_admin boolean not null,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  notified boolean not null default false
);
create index if not exists dm_messages_user_idx on public.dm_messages (user_id, created_at);
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
drop policy if exists "chat: ver propio" on public.dm_threads;
create policy "chat: ver propio" on public.dm_threads for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "chat: ver mensajes propios" on public.dm_messages;
create policy "chat: ver mensajes propios" on public.dm_messages for select using (user_id = auth.uid() or public.is_admin());
-- escribir solo con las funciones de abajo

create or replace function public.dm_days() returns int language sql stable security definer set search_path = public as $$
  select greatest(1, least(90, coalesce((select (data->>'chatDays')::int from public.site_settings where id = 1), 10))) $$;

-- enviar un mensaje. Admin: p_user = alumno. Alumno: p_user se ignora.
create or replace function public.dm_send(p_body text, p_user uuid default null, p_topic text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.is_admin(); u uuid; b text := trim(coalesce(p_body, '')); t public.dm_threads; m public.dm_messages;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if b = '' then raise exception 'Escribe un mensaje'; end if;
  if char_length(b) > 1500 then raise exception 'El mensaje es muy largo (máximo 1500 letras)'; end if;
  if adm and p_user is not null and p_user <> auth.uid() then
    u := p_user;
    insert into public.dm_threads (user_id, open, topic) values (u, true, coalesce(p_topic, ''))
    on conflict (user_id) do update set open = true, last_at = now(),
      topic = case when p_topic is not null and p_topic <> '' then p_topic else public.dm_threads.topic end;
  else
    u := auth.uid();
    select * into t from public.dm_threads where user_id = u;
    if not found then raise exception 'Todavía no tienes una conversación abierta'; end if;
    if not t.open then raise exception 'Esta conversación ya terminó'; end if;
    if (select banned from public.profiles where id = u) then raise exception 'Tu cuenta está suspendida'; end if;
    if (select count(*) from public.dm_messages where user_id = u and not from_admin and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'Has enviado muchos mensajes seguidos. Espera un rato.'; end if;
    update public.dm_threads set last_at = now() where user_id = u;
  end if;
  insert into public.dm_messages (user_id, from_admin, body, notified) values (u, adm and u <> auth.uid(), b, adm and u <> auth.uid())
  returning * into m;
  return to_jsonb(m) - 'notified';
end $$;
grant execute on function public.dm_send(text, uuid, text) to authenticated;

-- mi conversación (alumno): marca como leídos los mensajes del admin
create or replace function public.dm_mine() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.dm_threads;
begin
  if auth.uid() is null then return null; end if;
  select * into t from public.dm_threads where user_id = auth.uid();
  if not found then return jsonb_build_object('exists', false); end if;
  update public.dm_messages set read_at = now() where user_id = auth.uid() and from_admin and read_at is null;
  return jsonb_build_object('exists', true, 'open', t.open, 'topic', t.topic, 'days', public.dm_days(),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'mine', not from_admin, 'body', body, 'at', created_at, 'read', read_at is not null) order by created_at)
                          from public.dm_messages where user_id = auth.uid()), '[]'::jsonb));
end $$;
grant execute on function public.dm_mine() to authenticated;

-- ¿tengo conversación y mensajes sin leer? (para el globito)
create or replace function public.dm_badge() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object('admin', true,
      'unread', (select count(*) from public.dm_messages where not from_admin and read_at is null))
    else jsonb_build_object('exists', exists (select 1 from public.dm_threads where user_id = auth.uid()),
      'unread', (select count(*) from public.dm_messages where user_id = auth.uid() and from_admin and read_at is null)) end
$$;
grant execute on function public.dm_badge() to authenticated;

-- admin: lista de conversaciones
drop function if exists public.admin_dm_threads();
create function public.admin_dm_threads() returns table(user_id uuid, username text, avatar_url text, country text, open boolean, topic text, last_at timestamptz, last_body text, last_from_admin boolean, unread int, total int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select t.user_id, p.username, p.avatar_url, p.country, t.open, t.topic, t.last_at, l.body, l.from_admin,
      (select count(*) from public.dm_messages m where m.user_id = t.user_id and not m.from_admin and m.read_at is null)::int,
      (select count(*) from public.dm_messages m where m.user_id = t.user_id)::int
    from public.dm_threads t join public.profiles p on p.id = t.user_id
    left join lateral (select m.body, m.from_admin from public.dm_messages m where m.user_id = t.user_id order by m.created_at desc limit 1) l on true
    order by (select count(*) from public.dm_messages m where m.user_id = t.user_id and not m.from_admin and m.read_at is null) > 0 desc, t.last_at desc limit 300;
end $$;
grant execute on function public.admin_dm_threads() to authenticated;

-- admin: una conversación (marca como leídos los del alumno)
create or replace function public.admin_dm_thread(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.dm_threads;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select * into t from public.dm_threads where user_id = p_user;
  update public.dm_messages set read_at = now() where user_id = p_user and not from_admin and read_at is null;
  return jsonb_build_object('exists', t.user_id is not null, 'open', coalesce(t.open, true), 'topic', coalesce(t.topic, ''),
    'user', (select jsonb_build_object('id', p.id, 'username', p.username, 'avatar_url', p.avatar_url, 'country', p.country) from public.profiles p where p.id = p_user),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'mine', from_admin, 'body', body, 'at', created_at, 'read', read_at is not null) order by created_at)
                          from public.dm_messages where user_id = p_user), '[]'::jsonb));
end $$;
grant execute on function public.admin_dm_thread(uuid) to authenticated;

-- admin: finalizar = borrar la conversación ya
create or replace function public.admin_dm_close(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  delete from public.dm_threads where user_id = p_user;   -- borra también los mensajes
end $$;
grant execute on function public.admin_dm_close(uuid) to authenticated;

-- limpieza: mensajes de más de N días; conversaciones vacías y viejas
create or replace function public.dm_cleanup() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.dm_messages where created_at < now() - make_interval(days => public.dm_days());
  get diagnostics n = row_count;
  delete from public.dm_threads t where t.last_at < now() - make_interval(days => public.dm_days())
    and not exists (select 1 from public.dm_messages m where m.user_id = t.user_id);
  return n;
end $$;
revoke execute on function public.dm_cleanup() from public, anon, authenticated;

-- avisos al admin cuando un alumno responde (los toma la función send-push cada minuto)
create or replace function public.dm_push_claim() returns table(user_id uuid, username text, body text, n int)
language plpgsql security definer set search_path = public as $$
begin
  return query
    with c as (update public.dm_messages m set notified = true where not m.from_admin and not m.notified returning m.user_id, m.body, m.created_at)
    select c.user_id, p.username, (array_agg(c.body order by c.created_at desc))[1], count(*)::int
    from c join public.profiles p on p.id = c.user_id group by c.user_id, p.username;
end $$;
revoke execute on function public.dm_push_claim() from public, anon, authenticated;
grant execute on function public.dm_push_claim() to service_role;

-- el aviso automático de cada minuto ahora también revisa el chat
create or replace function public.reto_push_due() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges c where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now())
      or exists (select 1 from public.challenges c where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now())
      or exists (select 1 from public.dm_messages m where not m.from_admin and not m.notified)
$$;
revoke execute on function public.reto_push_due() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'chat-limpieza';
  perform cron.schedule('chat-limpieza', '17 8 * * *', 'select public.dm_cleanup()');   -- todos los días 3:17 a. m. Colombia
exception when others then
  raise notice 'No se pudo programar la limpieza del chat (%). Activa pg_cron y vuelve a correr este archivo.', sqlerrm;
end $$;

-- ===== perfil_publico.sql =====
-- =====================================================================
-- Perfil público: al tocar un nombre en el ranking, los retos o la comunidad se abre su tarjeta.
-- Correr DESPUÉS de chat.sql. Se puede correr varias veces.
-- Muestra solo lo que ya es público: foto, país, placa, afiliado, nivel, avance y retos.
-- Nunca muestra correo, ID de Deriv, cuenta de Binance ni pagos.
-- =====================================================================

drop function if exists public.public_profile(text);
create function public.public_profile(p_username text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; g public.progress; m timestamptz := date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
  total int; passed int; mpts int; pos int;
begin
  select * into p from public.profiles where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if not found or p.banned then return null; end if;
  select * into g from public.progress where user_id = p.id;
  select count(*) into total from public.lessons l join public.modules md on md.id = l.module_id where l.status = 'publicado' and md.status = 'publicado';
  select count(*) into passed from jsonb_each(coalesce(g.data->'done', '{}'::jsonb)) d
    where (d.value->>'passed')::boolean and exists (select 1 from public.lessons l where l.id::text = d.key and l.status = 'publicado');
  -- puntos del mes y puesto en el ranking del mes
  with pts as (select user_id, points, created_at from public.revealed_entries() where points > 0
               union all select user_id, points, created_at from public.reward_bonuses where points > 0),
       tot as (select x.user_id, sum(x.points)::int s from pts x join public.profiles q on q.id = x.user_id
               where x.created_at >= m and not q.banned and q.role <> 'admin' group by x.user_id)
  select coalesce((select s from tot where user_id = p.id), 0), (select 1 + count(*) from tot where s > coalesce((select s from tot where user_id = p.id), 0))
    into mpts, pos;
  return jsonb_build_object(
    'username', p.username, 'avatar_url', p.avatar_url, 'country', p.country, 'since', p.created_at,
    'is_admin', p.role = 'admin', 'is_me', coalesce(p.id = auth.uid(), false),
    'premium', coalesce(p.premium_until > now(), false),
    'plan', case when coalesce(p.premium_until > now(), false) then nullif(p.plan, '') end,
    'affiliate', coalesce(p.affiliate, false),
    'xp', coalesce(g.xp, 0), 'lessons', passed, 'lessons_total', total,
    'courses', coalesce((select jsonb_agg(jsonb_build_object('title', c.title, 'icon', c.icon, 'color', c.color,
        'graduated', (select count(*) from public.lessons l join public.modules md on md.id = l.module_id
                        where md.course_id = c.id and l.status = 'publicado') > 0
                     and not exists (select 1 from public.lessons l join public.modules md on md.id = l.module_id
                        where md.course_id = c.id and l.status = 'publicado'
                          and not coalesce((g.data->'done'->(l.id::text)->>'passed')::boolean, false)))
        order by c.sort)
      from public.user_courses uc join public.courses c on c.id = uc.course_id where uc.user_id = p.id), '[]'::jsonb),
    'month_points', mpts, 'month_pos', case when mpts > 0 then pos end,
    'points', coalesce((select sum(points) from public.revealed_entries() where user_id = p.id), 0)
              + coalesce((select sum(points) from public.reward_bonuses where user_id = p.id), 0),
    'wins', (select count(*) from public.revealed_entries() where user_id = p.id and place is not null),
    'firsts', (select count(*) from public.revealed_entries() where user_id = p.id and place = 1),
    'played', (select count(*) from public.challenge_entries where user_id = p.id),
    'streak', public.challenge_streak(p.id), 'best_streak', public.challenge_best_streak(p.id));
end $$;
grant execute on function public.public_profile(text) to anon, authenticated;

-- ===== sala_chat.sql =====
-- =====================================================================
-- Chat de la Sala Oro (Oro y Diamond). Correr DESPUÉS de perfil_publico.sql. Se puede correr varias veces.
--  - Sala grupal: no hay privados entre alumnos (evita estafas).
--  - Texto y 1 foto por mensaje. Enlaces solo el admin.
--  - Modo lento: 1 mensaje cada 8 s por alumno (roomSlow en Sitio).
--  - Moderación: borrar, silenciar (24 h o para siempre), reportes de los alumnos.
--  - Todo se borra solo a los 7 días (roomDays), fotos incluidas.
--  - Notificación a Oro y Diamond solo cuando escribe el admin.
-- =====================================================================

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  image_url text check (image_url is null or char_length(image_url) <= 400),
  created_at timestamptz not null default now()
);
create index if not exists room_messages_at_idx on public.room_messages (created_at desc);
create table if not exists public.room_mutes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  until timestamptz,                 -- null = para siempre
  created_at timestamptz not null default now()
);
create table if not exists public.room_reports (
  message_id uuid not null references public.room_messages(id) on delete cascade,
  reporter uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter)
);
alter table public.room_messages enable row level security;
alter table public.room_mutes enable row level security;
alter table public.room_reports enable row level security;
-- nadie lee las tablas directo: todo pasa por las funciones de abajo
drop policy if exists "sala: admin" on public.room_messages;
create policy "sala: admin" on public.room_messages for select using (public.is_admin());
drop policy if exists "sala silencios: admin" on public.room_mutes;
create policy "sala silencios: admin" on public.room_mutes for select using (public.is_admin());
drop policy if exists "sala reportes: admin" on public.room_reports;
create policy "sala reportes: admin" on public.room_reports for select using (public.is_admin());

-- carpeta de fotos de la sala: cada quien sube en su carpeta, máximo 3 MB, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sala', 'sala', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "sala fotos lectura" on storage.objects;
create policy "sala fotos lectura" on storage.objects for select using (bucket_id = 'sala');
drop policy if exists "sala fotos sube" on storage.objects;
create policy "sala fotos sube" on storage.objects for insert
  with check (bucket_id = 'sala' and (storage.foldername(name))[1] = auth.uid()::text and public.plan_rank() >= 3);
drop policy if exists "sala fotos borra" on storage.objects;
create policy "sala fotos borra" on storage.objects for delete using (bucket_id = 'sala' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create or replace function public.room_cfg(k text, d int) returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>k)::int from public.site_settings where id = 1), d) $$;

-- enviar
create or replace function public.room_send(p_body text, p_image text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.is_admin(); b text := trim(coalesce(p_body, '')); img text := nullif(trim(coalesce(p_image, '')), '');
  mu public.room_mutes; last timestamptz; slow int := greatest(0, public.room_cfg('roomSlow', 8)); m public.room_messages;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if public.plan_rank() < 3 then raise exception 'El chat es exclusivo de los planes Oro y Diamond'; end if;
  if (select banned from public.profiles where id = auth.uid()) then raise exception 'Tu cuenta está suspendida'; end if;
  if b = '' and img is null then raise exception 'Escribe un mensaje'; end if;
  if char_length(b) > 1000 then raise exception 'El mensaje es muy largo (máximo 1000 letras)'; end if;
  if img is not null and img not like '%/storage/v1/object/public/sala/' || auth.uid()::text || '/%' then raise exception 'Foto no válida'; end if;
  if not adm then
    select * into mu from public.room_mutes where user_id = auth.uid();
    if found and (mu.until is null or mu.until > now()) then
      raise exception '%', case when mu.until is null then 'No puedes escribir en el chat.' else 'Estás silenciado en el chat hasta ' || to_char(mu.until at time zone 'America/Bogota', 'DD/MM HH12:MI am') end;
    end if;
    if b ~* '(https?://|www\.|t\.me/|wa\.me/|chat\.whatsapp|discord\.gg|bit\.ly|[a-z0-9-]+\.(com|net|org|io|me|co|ly|gg|xyz|link|app|site|online|info|biz)(/|\s|$))' then
      raise exception 'Los enlaces no están permitidos en el chat'; end if;
    select max(created_at) into last from public.room_messages where user_id = auth.uid();
    if last is not null and last > now() - make_interval(secs => slow) then
      raise exception 'Espera unos segundos antes de enviar otro mensaje'; end if;
  end if;
  insert into public.room_messages (user_id, body, image_url) values (auth.uid(), b, img) returning * into m;
  return jsonb_build_object('id', m.id, 'created_at', m.created_at);
end $$;
grant execute on function public.room_send(text, text) to authenticated;

-- leer: los últimos mensajes (o solo los nuevos desde p_since)
drop function if exists public.room_feed(timestamptz);
create function public.room_feed(p_since timestamptz default null) returns table(id uuid, body text, image_url text, created_at timestamptz,
  username text, avatar_url text, country text, plan text, affiliate boolean, is_admin boolean, mine boolean, reports int, muted boolean)
language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.is_admin();
begin
  if public.plan_rank() < 3 then raise exception 'El chat es exclusivo de los planes Oro y Diamond'; end if;
  return query select * from (
    select m.id, m.body, m.image_url, m.created_at, p.username, p.avatar_url, p.country,
      case when p.premium_until > now() then nullif(p.plan, '') end, p.affiliate, p.role = 'admin', m.user_id = auth.uid(),
      case when adm then (select count(*)::int from public.room_reports r where r.message_id = m.id) else 0 end,
      case when adm then exists (select 1 from public.room_mutes u where u.user_id = m.user_id and (u.until is null or u.until > now())) else false end
    from public.room_messages m join public.profiles p on p.id = m.user_id
    where not p.banned and (p_since is null or m.created_at > p_since)
    order by m.created_at desc limit 150) x order by x.created_at;
end $$;
grant execute on function public.room_feed(timestamptz) to authenticated;

-- ids que siguen existiendo (para quitar de la pantalla los borrados)
create or replace function public.room_alive(p_ids uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select case when public.plan_rank() >= 3 then coalesce(array_agg(id), '{}') else '{}' end from public.room_messages where id = any(p_ids) $$;
grant execute on function public.room_alive(uuid[]) to authenticated;

-- borrar (el propio, o cualquiera si es admin)
create or replace function public.room_delete(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare m public.room_messages;
begin
  select * into m from public.room_messages where id = p_id;
  if not found then return null; end if;
  if m.user_id <> auth.uid() and not public.is_admin() then raise exception 'Solo puedes borrar tus mensajes'; end if;
  delete from public.room_messages where id = p_id;
  return m.image_url;   -- la página borra la foto
end $$;
grant execute on function public.room_delete(uuid) to authenticated;

-- reportar
create or replace function public.room_report(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.plan_rank() < 3 then raise exception 'No disponible'; end if;
  insert into public.room_reports (message_id, reporter) values (p_id, auth.uid()) on conflict do nothing;
end $$;
grant execute on function public.room_report(uuid) to authenticated;

-- silenciar (p_hours null = para siempre; 0 = quitar silencio). Se usa el nombre del mensaje.
create or replace function public.room_mute(p_message uuid, p_hours int) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select user_id into u from public.room_messages where id = p_message;
  if u is null then raise exception 'Ese mensaje ya no existe'; end if;
  if p_hours = 0 then delete from public.room_mutes where user_id = u; return; end if;
  insert into public.room_mutes (user_id, until) values (u, case when p_hours is null then null else now() + make_interval(hours => p_hours) end)
  on conflict (user_id) do update set until = excluded.until, created_at = now();
end $$;
grant execute on function public.room_mute(uuid, int) to authenticated;

-- limpieza a los N días: devuelve las fotos para que send-push las borre del almacenamiento
create or replace function public.room_cleanup_claim() returns text[]
language plpgsql security definer set search_path = public as $$
declare imgs text[];
begin
  with d as (delete from public.room_messages where created_at < now() - make_interval(days => greatest(1, public.room_cfg('roomDays', 7))) returning image_url)
  select coalesce(array_agg(image_url) filter (where image_url is not null), '{}') into imgs from d;
  delete from public.room_mutes where until is not null and until < now();
  return imgs;
end $$;
revoke execute on function public.room_cleanup_claim() from public, anon, authenticated;
grant execute on function public.room_cleanup_claim() to service_role;

-- el aviso automático de cada minuto también hace la limpieza de la sala
create or replace function public.reto_push_due() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges c where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now())
      or exists (select 1 from public.challenges c where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now())
      or exists (select 1 from public.dm_messages m where not m.from_admin and not m.notified)
      or exists (select 1 from public.room_messages r where r.created_at < now() - make_interval(days => greatest(1, public.room_cfg('roomDays', 7))))
$$;
revoke execute on function public.reto_push_due() from public, anon, authenticated;

-- ===== textos_banners.sql =====
-- =====================================================================
-- Banners nuevos del inicio + textos actualizados. Se puede correr varias veces.
--  - Los banners que tenías en el inicio quedan APAGADOS (no se borran): los puedes
--    volver a prender en Admin → Banners.
--  - Actualiza el texto de la página de precios, la tarjeta "Comunidad" y la fecha de los textos legales.
-- =====================================================================

-- 1) Banners del inicio
update public.slides set active = false where place = 'home' and image_url not like '%/assets/banners/%';
delete from public.slides where place = 'home' and image_url like '%/assets/banners/%';
insert into public.slides (place, title, body, image_url, cta_text, cta_link, sort, active) values
('home', 'Lee el gráfico como un arte',
 'El método de El Arte Gráfico para Boom y Crash: estructura, zonas, entradas y stop loss con reglas claras. Crea tu cuenta gratis y pruébalo.',
 'https://elartegrafico.com/assets/banners/metodo.webp', 'Empieza gratis', '#registro', 1, true),
('home', '¿Ganaste? Lo sabrás en 3 horas',
 'Cada día un reto nuevo. Los 5 primeros en acertar ganan puntos que cambias por USDT, pero nadie lo sabe hasta el final.',
 'https://elartegrafico.com/assets/banners/retos.webp', 'Ver el reto de hoy', '#retos', 2, true),
('home', 'Bienvenido a la Sala Oro',
 'Chat privado, lives y operativas para los traders Oro y Diamond. Comparte tus gráficas con los que van en serio.',
 'https://elartegrafico.com/assets/banners/sala-oro.webp', 'Ver planes', '#premium', 3, true),
('home', 'Que todos vean tu progreso',
 'Sube en el ranking y muestra tu nivel, tus placas y tus retos ganados. Toca cualquier nombre para ver su perfil.',
 'https://elartegrafico.com/assets/banners/ranking.webp', 'Ver ranking', '#ranking', 4, true);

-- 2) Textos del sitio
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
update public.site_settings set data = data
  || jsonb_build_object(
       'premiumTitle', 'Elige tu plan',
       'premiumText', 'Suscríbete con Cobre, Plata, Oro o Diamond, o compra solo el curso. Todos los planes incluyen la academia completa. Pagas con Binance Pay en USDT y no hay cobros automáticos.',
       'premiumItems', jsonb_build_array('La academia completa, con todos los cursos', 'Ejercicios con zona, stop loss y repetición', 'Práctica libre ilimitada', 'Desde Oro: Sala Oro con chat privado, lives y operativas'))
where id = 1;

-- tarjeta "Comunidad" de "Qué vas a aprender"
update public.site_settings set data = jsonb_set(data, '{cards}', (
    select jsonb_agg(case when c->>'title' = 'Comunidad'
      then jsonb_build_object('title', 'Comunidad', 'text', 'Noticias, retos diarios con premios y, desde el plan Oro, la Sala Oro: chat privado, lives y operativas.')
      else c end order by o)
    from jsonb_array_elements(data->'cards') with ordinality t(c, o)))
where id = 1 and jsonb_typeof(data->'cards') = 'array';

-- 3) Fecha de los textos legales (sale como "Última actualización")
update public.site_settings set data = jsonb_set(data, '{legalInfo}', coalesce(data->'legalInfo', '{}'::jsonb) || '{"date":"11 de noviembre de 2026"}'::jsonb)
where id = 1;

-- 4) Revisión: si esta consulta muestra algún nombre (terminos, privacidad, pagos, retos…), ese texto legal
--    lo habías editado a mano y NO tomará la versión nueva. Entra a Admin → Legal y toca
--    "Restaurar texto base" en ese documento. Si sale vacío, todo quedó actualizado.
select jsonb_object_keys(coalesce(data->'legalDocs', '{}'::jsonb)) as textos_legales_editados_a_mano
from public.site_settings where id = 1;

-- ===== planes_vitalicio.sql =====
-- =====================================================================
-- Diamond VITALICIO. Correr después de planes_diamond.sql. Se puede correr varias veces.
--  - El plan Diamond (100 USDT) pasa a ser de por vida: en Admin → Sitio → Planes queda
--    con "vitalicio" en los días (por dentro son 36500 días).
--  - Permite aprobar pagos de planes vitalicios.
-- =====================================================================

-- los pagos aceptan planes vitalicios
alter table public.payment_requests drop constraint if exists payment_requests_days_check;
alter table public.payment_requests add constraint payment_requests_days_check check (days between 1 and 36500);

-- el plan Diamond de la página de precios queda vitalicio
update public.site_settings s set data = jsonb_set(s.data, '{plans}', (
    select jsonb_agg(case when lower(coalesce(x->>'tier','')) = 'diamond' or (x->>'price') ~ '^\s*100(\D|$)'
      then x || '{"tier":"diamond","days":36500}'::jsonb else x end order by o)
    from jsonb_array_elements(s.data->'plans') with ordinality t(x, o)))
where s.id = 1 and jsonb_typeof(s.data->'plans') = 'array' and jsonb_array_length(s.data->'plans') > 0;

-- quien ya tenga Diamond queda de por vida
update public.profiles set premium_until = now() + interval '36500 days'
where plan = 'diamond' and premium_until > now() and premium_until < now() + interval '30 years';

-- aprobar pagos (igual que antes, pero acepta hasta 36500 días)
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
    if d < 1 or d > 36500 then raise exception 'Días no válidos'; end if;
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

-- revisión: así quedan tus planes
select x->>'name' as plan, x->>'days' as dias, x->>'price' as precio, x->>'tier' as placa
from public.site_settings, jsonb_array_elements(data->'plans') x where id = 1;

-- ===== novedades.sql =====
-- =====================================================================
-- Novedades: panel de atención, certificados, lanzamiento con contador y práctica sin cuenta.
-- Correr DESPUÉS de planes_vitalicio.sql. Se puede correr varias veces.
-- =====================================================================

-- ---------- 1) Panel "qué necesita mi atención" ----------
create or replace function public.admin_attention() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb := '{}'::jsonb; t boolean;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  r := r || jsonb_build_object('payments', (select count(*) from public.payment_requests where status = 'pendiente'));
  r := r || jsonb_build_object('affiliates', (select count(*) from public.affiliates where status = 'pendiente'));
  r := r || jsonb_build_object('affiliates_old', (select count(*) from public.affiliates a join public.partner_clients c on c.deriv_id = upper(a.deriv_id) where a.status = 'pendiente' and c.tier = 'antiguo'));
  r := r || jsonb_build_object('redemptions', (select count(*) from public.redemptions where status = 'pendiente'));
  r := r || jsonb_build_object('reviews', (select count(*) from public.reviews where not approved));
  begin r := r || jsonb_build_object('dms', (select count(*) from public.dm_messages where not from_admin and read_at is null)); exception when undefined_table then null; end;
  begin r := r || jsonb_build_object('reports', (select count(distinct message_id) from public.room_reports)); exception when undefined_table then null; end;
  -- retos: ¿hay reto en juego y programado para las próximas 24 h?
  r := r || jsonb_build_object(
    'reto_live', exists (select 1 from public.challenges c where c.status = 'publicado' and c.starts_at <= now() and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) > now()),
    'reto_next', (select min(starts_at) from public.challenges where status = 'publicado' and starts_at > now()),
    'reto_drafts', (select count(*) from public.challenges where status <> 'publicado'),
    'retos_on', coalesce((public.rewards_cfg()->>'enabled')::boolean, false));
  -- planes que vencen en los próximos 7 días
  r := r || jsonb_build_object('expiring', (select count(*) from public.profiles where premium_until between now() and now() + interval '7 days'));
  return r;
end $$;
grant execute on function public.admin_attention() to authenticated;

-- ---------- 2) Certificados ----------
create table if not exists public.certificates (
  code text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  username text not null,
  course_title text not null,
  lessons int not null default 0,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table public.certificates enable row level security;
drop policy if exists "certificados: propios" on public.certificates;
create policy "certificados: propios" on public.certificates for select using (user_id = auth.uid() or public.is_admin());

-- emitir (o devolver) mi certificado de un curso: solo si aprobé todas sus lecciones publicadas
create or replace function public.claim_certificate(p_course uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.courses; g public.progress; total int; passed int; cert public.certificates; nm text; v_code text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into cert from public.certificates where user_id = auth.uid() and course_id = p_course;
  if found then return to_jsonb(cert) - 'user_id'; end if;
  select * into c from public.courses where id = p_course;
  if not found then raise exception 'Ese curso no existe'; end if;
  select * into g from public.progress where user_id = auth.uid();
  select count(*), count(*) filter (where coalesce((g.data->'done'->(l.id::text)->>'passed')::boolean, false))
    into total, passed
    from public.lessons l join public.modules m on m.id = l.module_id
    where m.course_id = p_course and l.status = 'publicado' and m.status = 'publicado';
  if total = 0 or passed < total then raise exception 'Aún te faltan % lecciones de este curso', greatest(total - passed, 1); end if;
  select username into nm from public.profiles where id = auth.uid();
  loop
    v_code := 'EAG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from public.certificates x where x.code = v_code);
  end loop;
  insert into public.certificates (code, user_id, course_id, username, course_title, lessons)
  values (v_code, auth.uid(), p_course, nm, c.title, total) returning * into cert;
  return to_jsonb(cert) - 'user_id';
end $$;
grant execute on function public.claim_certificate(uuid) to authenticated;

-- mis certificados
create or replace function public.my_certificates() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(c) - 'user_id' order by c.issued_at), '[]'::jsonb) from public.certificates c where c.user_id = auth.uid() $$;
grant execute on function public.my_certificates() to authenticated;

-- verificación pública (cualquiera con el código)
create or replace function public.verify_certificate(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', c.code, 'username', c.username, 'course_title', c.course_title, 'lessons', c.lessons, 'issued_at', c.issued_at,
    'avatar_url', p.avatar_url, 'country', p.country, 'color', co.color, 'icon', co.icon)
  from public.certificates c join public.profiles p on p.id = c.user_id left join public.courses co on co.id = c.course_id
  where c.code = upper(trim(coalesce(p_code, ''))) and not p.banned $$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------- 3) Lanzamiento de la academia con contador ----------
-- Admin → Sitio guarda academyOpenAt (fecha y hora de apertura). A esa hora, la revisión de cada
-- minuto abre la academia sola, arranca la prueba gratis de 7 días y avisa a todos.
create or replace function public.launch_due() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'academyClosed')::boolean and (data->>'academyOpenAt') is not null
    and (data->>'academyOpenAt')::timestamptz <= now() from public.site_settings where id = 1), false) $$;
revoke execute on function public.launch_due() from public, anon, authenticated;

create or replace function public.launch_claim() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.launch_due() then return false; end if;
  update public.site_settings set data = data || jsonb_build_object('academyClosed', false, 'trialFrom', now(), 'launchedAt', now()) where id = 1;
  return true;
end $$;
revoke execute on function public.launch_claim() from public, anon, authenticated;
grant execute on function public.launch_claim() to service_role;

create or replace function public.reto_push_due() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges c where c.status = 'publicado' and c.notified_at is null and c.starts_at <= now())
      or exists (select 1 from public.challenges c where c.status = 'publicado' and c.results_notified_at is null
                 and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly) <= now())
      or exists (select 1 from public.dm_messages m where not m.from_admin and not m.notified)
      or exists (select 1 from public.room_messages r where r.created_at < now() - make_interval(days => greatest(1, public.room_cfg('roomDays', 7))))
      or public.launch_due()
$$;
revoke execute on function public.reto_push_due() from public, anon, authenticated;

-- ---------- 4) Práctica sin cuenta ----------
-- En Admin → Ejercicios marcas uno como "Pruébalo sin cuenta". Si no hay ninguno, se usa la
-- primera gráfica de prueba gratis.
alter table public.exercises add column if not exists free_try boolean not null default false;

create or replace function public.try_exercise() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(e) from public.exercises e
  where e.free_try or (e.is_demo and e.kind in ('grafica', 'no-operar') and not exists (select 1 from public.exercises x where x.free_try))
  order by e.free_try desc, e.sort limit 1 $$;
grant execute on function public.try_exercise() to anon, authenticated;

create or replace function public.try_grade(ex uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.exercise_answers; t jsonb := public.try_exercise();
begin
  if t is null or (t->>'id')::uuid <> ex then return jsonb_build_object('error', 'no_existe'); end if;
  select * into a from public.exercise_answers where exercise_id = ex;
  return jsonb_build_object('zone', a.zone, 'sl', a.sl, 'answer', coalesce(a.answer, '{}'::jsonb), 'explain', coalesce(a.explain, ''));
end $$;
grant execute on function public.try_grade(uuid) to anon, authenticated;

-- ===== curso_fundamentos.sql =====
-- =====================================================================
-- Curso base "Fundamentos del trading". Correr DESPUÉS de novedades.sql. Se puede correr varias veces.
--  - Nuevo curso "Fundamentos del trading" (primero en la lista), GRATIS y completo para cualquier
--    cuenta registrada. No se vende.
--  - Todos los módulos con categoría "Fundamentos" pasan a este curso; el resto se queda en Boom y Crash.
-- =====================================================================
alter table public.courses add column if not exists base boolean not null default false;

insert into public.courses (title, descr, color, icon, price, status, sort, base)
select 'Fundamentos del trading',
       'Lo que necesitas antes de cualquier mercado: cómo funciona el trading, tu bróker y MT5, velas, temporalidades, gestión del riesgo y psicología.',
       '#d8b062', '📚', 'Gratis', 'publicado', 0, true
where not exists (select 1 from public.courses where base);

update public.courses set sort = 0, price = 'Gratis' where base;
update public.courses set sort = greatest(sort, 1) where not base;

-- los módulos de fundamentos pasan al curso base
update public.modules set course_id = (select id from public.courses where base order by created_at limit 1)
where lower(coalesce(category, '')) like 'fundamento%';

-- acceso: el curso que compraste, o el curso gratis si tienes cuenta
create or replace function public.course_module_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = mid and (c.base
      or exists (select 1 from public.user_courses uc where uc.user_id = auth.uid() and uc.course_id = m.course_id)))
$$;
grant execute on function public.course_module_ok(uuid) to authenticated;

-- el curso base no se puede comprar suelto
create or replace function public.no_vender_base() returns trigger
language plpgsql as $$
begin
  if new.course_id is not null and exists (select 1 from public.courses where id = new.course_id and base) then
    raise exception 'Ese curso es gratis con tu cuenta; no hay que pagarlo.';
  end if;
  return new;
end $$;
drop trigger if exists no_vender_base on public.payment_requests;
create trigger no_vender_base before insert on public.payment_requests for each row execute function public.no_vender_base();

-- revisión: así quedan tus cursos y módulos
select c.title as curso, c.base as curso_base, m.sort, m.title as modulo, m.status, m.free as prueba_gratis
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;

-- ===== textos_fundamentos.sql =====
-- =====================================================================
-- Textos y banner: "Fundamentos del trading es gratis; la estrategia de cada mercado es lo que se paga".
-- Correr DESPUÉS de curso_fundamentos.sql. Se puede correr varias veces.
-- =====================================================================

-- 1) Banner nuevo, primero en el inicio
delete from public.slides where place = 'home' and image_url like '%/assets/banners/fundamentos.webp';
insert into public.slides (place, title, body, image_url, cta_text, cta_link, sort, active) values
('home', 'Aprende trading gratis',
 'El curso Fundamentos del trading es gratis y completo con tu cuenta: bróker, MT5, velas, estructura y riesgo. Después eliges la estrategia de tu mercado.',
 'https://elartegrafico.com/assets/banners/fundamentos.webp', 'Crear cuenta gratis', '#registro', 0, true);

-- el banner del método ahora apunta a la estrategia (lo que se paga)
update public.slides set
  title = 'La estrategia de Boom y Crash',
  body = 'Cuando termines Fundamentos, aplica el método de El Arte Gráfico en Boom y Crash: zonas, entradas y stop loss con reglas claras.',
  cta_text = 'Ver precios', cta_link = '#premium', sort = 1
where place = 'home' and image_url like '%/assets/banners/metodo.webp';

-- 2) Portada y página de precios
update public.site_settings set data = data
  || jsonb_build_object(
       'heroText', 'Empieza gratis con el curso Fundamentos del trading. Cuando estés listo, elige la estrategia de El Arte Gráfico para tu mercado y practícala en gráficas reales.',
       'premiumTitle', 'Elige tu plan',
       'premiumText', 'Fundamentos del trading es gratis con tu cuenta. Lo que se paga es la estrategia de cada mercado: compra solo el curso que quieras, o suscríbete con Cobre, Plata, Oro o Diamond y tienes todos los cursos. Pagas con Binance Pay en USDT y no hay cobros automáticos.',
       'premiumItems', jsonb_build_array('Todos los cursos de estrategia, como Boom y Crash', 'Ejercicios con zona, stop loss y repetición', 'Práctica libre ilimitada', 'Desde Oro: Sala Oro con chat privado, lives y operativas'))
where id = 1;

-- 3) Preguntas frecuentes (solo si las editaste en Admin; si no, la página ya usa las nuevas)
update public.site_settings set data = jsonb_set(data, '{faq}',
  jsonb_build_array(jsonb_build_object('q', '¿Qué es gratis y qué se paga?',
    'a', 'El curso Fundamentos del trading es gratis y completo con tu cuenta: bróker, MT5, velas, estructura y gestión del riesgo. Lo que tiene costo son los cursos de estrategia para cada mercado, como Boom y Crash: lo compras una vez o lo tienes con cualquier plan.'))
  || (select coalesce(jsonb_agg(f), '[]'::jsonb) from jsonb_array_elements(data->'faq') f where f->>'q' <> '¿Qué es gratis y qué se paga?'))
where id = 1 and jsonb_typeof(data->'faq') = 'array' and jsonb_array_length(data->'faq') > 0;

-- 4) Banner de la pantalla de ingreso
update public.slides set title = 'Fundamentos del trading, gratis',
  body = 'Crea tu cuenta y haz el curso completo sin pagar: bróker, MT5, velas, estructura y riesgo.'
where place = 'login' and title in ('5 gráficas de prueba gratis');

select place, sort, title, active from public.slides where place in ('home', 'login') order by place, sort;

-- ===== curso_fundamentos.sql (v2: la introducción vuelve a Boom y Crash) =====
-- =====================================================================
-- Curso base "Fundamentos del trading". Correr DESPUÉS de novedades.sql. Se puede correr varias veces.
--  - Nuevo curso "Fundamentos del trading" (primero en la lista), GRATIS y completo para cualquier
--    cuenta registrada. No se vende.
--  - Los módulos con categoría "Fundamentos" pasan a este curso (abrir cuenta, Deriv y MT5, velas…), MENOS
--    "Bienvenida e introducción": esa es de Boom y Crash y se queda (o vuelve) a ese curso.
--  - Si ya lo habías corrido, córrelo otra vez: devuelve la introducción a Boom y Crash.
-- =====================================================================
alter table public.courses add column if not exists base boolean not null default false;

insert into public.courses (title, descr, color, icon, price, status, sort, base)
select 'Fundamentos del trading',
       'Lo que necesitas antes de cualquier mercado: cómo abrir tu cuenta, tu bróker y MT5, velas japonesas y estructura del mercado.',
       '#d8b062', '📚', 'Gratis', 'publicado', 0, true
where not exists (select 1 from public.courses where base);

update public.courses set sort = 0, price = 'Gratis' where base;
update public.courses set sort = greatest(sort, 1) where not base;

-- los módulos de fundamentos pasan al curso base
update public.modules set course_id = (select id from public.courses where base order by created_at limit 1)
where lower(coalesce(category, '')) like 'fundamento%'
  and lower(title) not like '%bienvenida%' and lower(title) not like '%introducci%';

-- la introducción es de Boom y Crash (cada mercado se mueve distinto): vuelve al primer curso de pago
update public.modules set
  course_id = (select id from public.courses where not base order by sort, created_at limit 1),
  category = 'Introducción'
where (lower(title) like '%bienvenida%' or lower(title) like '%introducci%')
  and exists (select 1 from public.courses where not base);

-- acceso: el curso que compraste, o el curso gratis si tienes cuenta
create or replace function public.course_module_ok(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = mid and (c.base
      or exists (select 1 from public.user_courses uc where uc.user_id = auth.uid() and uc.course_id = m.course_id)))
$$;
grant execute on function public.course_module_ok(uuid) to authenticated;

-- el curso base no se puede comprar suelto
create or replace function public.no_vender_base() returns trigger
language plpgsql as $$
begin
  if new.course_id is not null and exists (select 1 from public.courses where id = new.course_id and base) then
    raise exception 'Ese curso es gratis con tu cuenta; no hay que pagarlo.';
  end if;
  return new;
end $$;
drop trigger if exists no_vender_base on public.payment_requests;
create trigger no_vender_base before insert on public.payment_requests for each row execute function public.no_vender_base();

-- revisión: así quedan tus cursos y módulos
select c.title as curso, c.base as curso_base, m.sort, m.title as modulo, m.status, m.free as prueba_gratis
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;

-- ===== textos_fundamentos.sql (v2) =====
-- =====================================================================
-- Textos y banner: "Fundamentos del trading es gratis; la estrategia de cada mercado es lo que se paga".
-- Correr DESPUÉS de curso_fundamentos.sql. Se puede correr varias veces.
-- =====================================================================

-- 1) Banner nuevo, primero en el inicio
delete from public.slides where place = 'home' and image_url like '%/assets/banners/fundamentos.webp';
insert into public.slides (place, title, body, image_url, cta_text, cta_link, sort, active) values
('home', 'Aprende trading gratis',
 'El curso Fundamentos del trading es gratis y completo con tu cuenta: bróker, MT5, velas japonesas y estructura del mercado. Después eliges la estrategia de tu mercado.',
 'https://elartegrafico.com/assets/banners/fundamentos.webp', 'Crear cuenta gratis', '#registro', 0, true);

-- el banner del método ahora apunta a la estrategia (lo que se paga)
update public.slides set
  title = 'La estrategia de Boom y Crash',
  body = 'Cuando termines Fundamentos, aplica el método de El Arte Gráfico en Boom y Crash: zonas, entradas y stop loss con reglas claras.',
  cta_text = 'Ver precios', cta_link = '#premium', sort = 1
where place = 'home' and image_url like '%/assets/banners/metodo.webp';

-- 2) Portada y página de precios
update public.site_settings set data = data
  || jsonb_build_object(
       'heroText', 'Empieza gratis con el curso Fundamentos del trading. Cuando estés listo, elige la estrategia de El Arte Gráfico para tu mercado y practícala en gráficas reales.',
       'premiumTitle', 'Elige tu plan',
       'premiumText', 'Fundamentos del trading es gratis con tu cuenta. Lo que se paga es la estrategia de cada mercado: compra solo el curso que quieras, o suscríbete con Cobre, Plata, Oro o Diamond y tienes todos los cursos. Pagas con Binance Pay en USDT y no hay cobros automáticos.',
       'premiumItems', jsonb_build_array('Todos los cursos de estrategia, como Boom y Crash', 'Ejercicios con zona, stop loss y repetición', 'Práctica libre ilimitada', 'Desde Oro: Sala Oro con chat privado, lives y operativas'))
where id = 1;

-- 3) Preguntas frecuentes (solo si las editaste en Admin; si no, la página ya usa las nuevas)
update public.site_settings set data = jsonb_set(data, '{faq}',
  jsonb_build_array(jsonb_build_object('q', '¿Qué es gratis y qué se paga?',
    'a', 'El curso Fundamentos del trading es gratis y completo con tu cuenta: bróker, MT5, velas japonesas y estructura del mercado. Lo que tiene costo son los cursos de estrategia para cada mercado, como Boom y Crash: lo compras una vez o lo tienes con cualquier plan.'))
  || (select coalesce(jsonb_agg(f), '[]'::jsonb) from jsonb_array_elements(data->'faq') f where f->>'q' <> '¿Qué es gratis y qué se paga?'))
where id = 1 and jsonb_typeof(data->'faq') = 'array' and jsonb_array_length(data->'faq') > 0;

-- 4) Banner de la pantalla de ingreso
update public.slides set title = 'Fundamentos del trading, gratis',
  body = 'Crea tu cuenta y haz el curso completo sin pagar: bróker, MT5, velas japonesas y estructura del mercado.'
where place = 'login' and title in ('5 gráficas de prueba gratis');

select place, sort, title, active from public.slides where place in ('home', 'login') order by place, sort;

-- ===== pagos_chat.sql =====
-- =====================================================================
-- Pagos en el chat privado. Correr DESPUÉS de chat.sql. Se puede correr varias veces.
--  - Cuando un alumno registra un pago, le llega a El Arte Gráfico un mensaje en el chat privado de ese alumno
--    (con el plan, el monto, la orden y su nota). Te llega el aviso al celular igual que cualquier mensaje.
--  - El alumno puede seguir escribiendo en ese mismo chat si el pago se demora.
--  - Cuando apruebas o rechazas el pago, le queda un mensaje tuyo en ese chat con el resultado.
-- =====================================================================

create or replace function public.pago_al_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text; c text;
begin
  if tg_op = 'INSERT' then
    select title into c from public.courses where id = new.course_id;
    txt := '💳 Registré un pago: ' || coalesce('curso ' || c, nullif(new.plan, ''), 'plan')
           || coalesce(' · ' || nullif(new.amount, ''), '') || ' · orden ' || new.order_id
           || coalesce(E'\n' || nullif(trim(new.note), ''), '');
    insert into public.dm_threads (user_id, open) values (new.user_id, true)
      on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body) values (new.user_id, false, left(txt, 1500));
  elsif tg_op = 'UPDATE' and old.status = 'pendiente' and new.status <> 'pendiente' then
    txt := case when new.status = 'aprobado'
      then '✅ Tu pago de la orden ' || new.order_id || ' fue aprobado y ya tienes tu acceso. ¡Bienvenido!'
      else '❌ Tu pago de la orden ' || new.order_id || ' no se pudo confirmar.'
           || coalesce(' Motivo: ' || nullif(trim(new.admin_note), '') || '.', '')
           || ' Escríbeme por aquí y lo revisamos.' end;
    insert into public.dm_threads (user_id, open) values (new.user_id, true)
      on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body, notified) values (new.user_id, true, left(txt, 1500), true);
  end if;
  return new;
exception when others then
  return new;   -- si el chat falla, el pago igual se registra
end $$;

drop trigger if exists pago_al_chat on public.payment_requests;
create trigger pago_al_chat after insert or update of status on public.payment_requests
  for each row execute function public.pago_al_chat();

-- ===== intro_a_fundamentos.sql =====
-- =====================================================================
-- "Bienvenida e introducción" pasa a ser el PRIMER módulo del curso gratis Fundamentos del trading.
-- Se puede correr varias veces. No toca lecciones, videos ni ejercicios: solo cambia de curso y de orden.
-- =====================================================================
update public.modules set
  course_id = (select id from public.courses where base order by created_at limit 1),
  sort = coalesce((select min(m2.sort) from public.modules m2 join public.courses c2 on c2.id = m2.course_id
                   where c2.base and m2.id <> public.modules.id), 1) - 1
where (lower(title) like '%bienvenida%' or lower(title) like '%introducci%')
  and exists (select 1 from public.courses where base);

select c.title as curso, m.sort as orden, m.title as modulo, m.status
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;

-- ===== puntos_admin.sql =====
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

-- ===== estructura_a_boom.sql =====
-- =====================================================================
-- "Estructura del mercado" pasa a ser el PRIMER módulo del curso Boom y Crash (de pago).
-- Se puede correr varias veces. No toca lecciones, videos ni ejercicios: solo cambia de curso, de orden
-- y de categoría (para que el SQL de Fundamentos no lo vuelva a mover).
-- También actualiza los textos que decían que la estructura del mercado venía en Fundamentos.
-- =====================================================================
update public.modules set
  course_id = (select id from public.courses where not base order by sort, created_at limit 1),
  category = 'Estructura',
  sort = coalesce((select min(m2.sort) from public.modules m2 join public.courses c2 on c2.id = m2.course_id
                   where not c2.base and m2.id <> public.modules.id
                     and c2.id = (select id from public.courses where not base order by sort, created_at limit 1)), 1) - 1
where lower(title) like '%estructura del mercado%'
  and exists (select 1 from public.courses where not base);

-- textos: Fundamentos ahora es bróker, MT5, sintéticos y velas
update public.slides set body = replace(replace(body,
    'bróker, MT5, velas japonesas y estructura del mercado', 'bróker, MT5, índices sintéticos y velas japonesas'),
    'velas, estructura y riesgo', 'índices sintéticos y velas japonesas')
where body like '%estructura del mercado%' or body like '%estructura y riesgo%';

update public.slides set body = 'Cuando termines Fundamentos, entra a Boom y Crash: estructura del mercado, zonas, entradas y stop loss con reglas claras.'
where image_url like '%/assets/banners/metodo.webp%';

update public.site_settings set data = jsonb_set(data, '{faq}', (
    select jsonb_agg(jsonb_build_object('q', f->>'q', 'a', replace(replace(f->>'a',
        'bróker, MT5, velas japonesas y estructura del mercado', 'qué es un bróker, MT5, índices sintéticos y velas japonesas'),
        'cómo leer las velas y la estructura del mercado', 'qué son los índices sintéticos y cómo leer las velas')) order by o)
    from jsonb_array_elements(data->'faq') with ordinality t(f, o)))
where id = 1 and jsonb_typeof(data->'faq') = 'array' and jsonb_array_length(data->'faq') > 0;

select c.title as curso, m.sort as orden, m.title as modulo, m.category as categoria, m.status
from public.modules m left join public.courses c on c.id = m.course_id
order by c.sort nulls last, m.sort;

-- ===== retos_express.sql =====
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

-- ===== saldo_admin.sql =====
-- =====================================================================
-- Admin: sumar o quitar SALDO (USD) a mano. Correr DESPUÉS de retos_express.sql. Se puede correr varias veces.
--  - Para premios de lives, sorteos, correcciones, etc. Queda registrado con el motivo.
--  - Al alumno le llega un mensaje en Mensajes avisándole.
-- =====================================================================
create table if not exists public.usd_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usd numeric(10,2) not null check (usd <> 0),
  motivo text not null default '' check (char_length(motivo) <= 120),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.usd_adjustments enable row level security;
drop policy if exists "ajustes usd: ver" on public.usd_adjustments;
create policy "ajustes usd: ver" on public.usd_adjustments for select using (user_id = auth.uid() or public.is_admin());

-- el saldo ahora suma también los ajustes del admin
create or replace function public.usd_balance(p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(coalesce((select sum(e.usd) from public.challenge_entries e join public.challenges c on c.id = e.challenge_id
                          where e.user_id = p_user and e.usd > 0
                            and public.challenge_close_at(c.starts_at, c.ends_at, c.weekly or c.express) <= now()), 0)
             + coalesce((select sum(usd) from public.usd_adjustments where user_id = p_user), 0)
             - coalesce((select sum(usd) from public.usd_withdrawals where user_id = p_user and status <> 'rechazado'), 0), 2)
$$;
revoke execute on function public.usd_balance(uuid) from public, anon, authenticated;

create or replace function public.admin_adjust_usd(p_username text, p_usd numeric, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.profiles; v numeric := round(coalesce(p_usd, 0), 2); bal numeric; motivo text := left(trim(coalesce(p_reason, '')), 120);
  m text;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if v = 0 then raise exception 'Escribe el monto: 2 para sumar o -2 para quitar.'; end if;
  if abs(v) > 1000 then raise exception 'Eso es demasiado de una vez.'; end if;
  select * into u from public.profiles where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if not found then raise exception 'No encontré a %', p_username; end if;
  bal := public.usd_balance(u.id);
  if bal + v < 0 then raise exception '% tiene US$ % de saldo: no le puedes quitar %.', u.username, bal, abs(v); end if;
  insert into public.usd_adjustments (user_id, usd, motivo) values (u.id, v, motivo);
  m := replace(to_char(abs(v), 'FM999990.00'), '.', ',');
  begin
    insert into public.dm_threads (user_id, open) values (u.id, true) on conflict (user_id) do update set open = true, last_at = now();
    insert into public.dm_messages (user_id, from_admin, body, notified) values (u.id, true,
      case when v > 0 then '💵 Te agregué US$ ' || m || ' a tu saldo' else '💵 Te descontamos US$ ' || m || ' de tu saldo' end
      || coalesce(' · ' || nullif(motivo, ''), '') || '. Lo ves en Saldo y puntos.', true);
  exception when others then null;
  end;
  return jsonb_build_object('username', u.username, 'saldo', bal + v);
end $$;
grant execute on function public.admin_adjust_usd(text, numeric, text) to authenticated;

create or replace function public.admin_usd_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select a.created_at, a.usd, a.motivo, p.username from public.usd_adjustments a join public.profiles p on p.id = a.user_id
    order by a.created_at desc limit 20) x), '[]'::jsonb);
end $$;
grant execute on function public.admin_usd_log() to authenticated;
