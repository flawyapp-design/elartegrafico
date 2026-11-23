-- =====================================================================
-- BIBLIOTECA DE CLASES (dentro de la Academia)
-- Clases grabadas (grupales y personalizadas) para quien ya sabe operar
-- y quiere ir al grano. Pago único. Se puede abrir aunque la academia
-- todavía esté cerrada.
--   · Se vende como un "curso" más (pago con el mismo flujo): kind = 'biblioteca'
--   · Videos propios (no son lecciones de la academia: sin cuestionarios ni bloqueo)
--   · Quién ve qué y cuánto tiempo, calificación por video, preguntas por video
--   · Al terminar (o al ver el % que elijas), el alumno pide su clase personalizada de 2 h
-- Correr en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

-- el producto (fila en cursos, así usa el mismo pago y "Dar curso" del admin)
alter table public.courses add column if not exists kind text not null default 'curso';
insert into public.courses (title, descr, color, icon, price, status, sort, kind)
select 'Biblioteca de clases',
       'Clases grabadas, grupales y personalizadas, donde explico cómo opero. Para quien ya sabe operar y quiere ir al grano.',
       '#1f4fd6', '📚', '50 USD', 'publicado', 90, 'biblioteca'
where not exists (select 1 from public.courses where kind = 'biblioteca');

create or replace function public.lib_course() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.courses where kind = 'biblioteca' order by created_at limit 1
$$;
grant execute on function public.lib_course() to anon, authenticated;

-- ¿tiene la biblioteca? (la compró, se la dio el admin, o es admin)
create or replace function public.lib_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.user_courses uc join public.profiles p on p.id = uc.user_id
    where uc.user_id = auth.uid() and uc.course_id = public.lib_course() and not coalesce(p.banned,false))
$$;
grant execute on function public.lib_ok() to authenticated;

-- ---------------------------------------------------------------------
-- videos de la biblioteca
-- ---------------------------------------------------------------------
create table if not exists public.lib_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 140),
  descr text not null default '' check (char_length(descr) <= 2000),
  section text not null default 'Clases grupales' check (char_length(section) <= 60),
  video_url text not null default '' check (char_length(video_url) <= 600),
  minutes int check (minutes is null or minutes between 1 and 1000),
  sort int not null default 1,
  status text not null default 'borrador' check (status in ('borrador','publicado')),
  free_preview boolean not null default false,          -- si es true, cualquiera con cuenta lo puede ver de muestra
  created_at timestamptz not null default now()
);
alter table public.lib_items enable row level security;
drop policy if exists "biblioteca: leer" on public.lib_items;
-- todos ven el listado publicado (para la página de venta); el video solo llega por lib_item()
create policy "biblioteca: leer" on public.lib_items for select using (status = 'publicado' or public.is_admin());
drop policy if exists "biblioteca: admin" on public.lib_items;
create policy "biblioteca: admin" on public.lib_items for all using (public.is_admin()) with check (public.is_admin());
-- el enlace del video no se entrega a quien no tiene la biblioteca
revoke all on public.lib_items from anon, authenticated;
grant select (id, title, descr, section, minutes, sort, status, free_preview, created_at) on public.lib_items to anon, authenticated;

-- admin: listado completo (con enlaces), guardar y borrar
create or replace function public.lib_admin_list()
returns setof public.lib_items language sql stable security definer set search_path = public as $$
  select * from public.lib_items where public.is_admin() order by sort, created_at
$$;
grant execute on function public.lib_admin_list() to authenticated;
create or replace function public.lib_save(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  if nullif(p->>'id','') is null then
    insert into public.lib_items (title, descr, section, video_url, minutes, sort, status, free_preview)
    values (p->>'title', coalesce(p->>'descr',''), coalesce(nullif(p->>'section',''),'Clases grupales'), coalesce(p->>'video_url',''),
            nullif(p->>'minutes','')::int, coalesce(nullif(p->>'sort','')::int,1), coalesce(nullif(p->>'status',''),'borrador'), coalesce((p->>'free_preview')::boolean,false))
    returning id into nid;
  else
    update public.lib_items set title = p->>'title', descr = coalesce(p->>'descr',''), section = coalesce(nullif(p->>'section',''),'Clases grupales'),
      video_url = coalesce(p->>'video_url',''), minutes = nullif(p->>'minutes','')::int, sort = coalesce(nullif(p->>'sort','')::int,1),
      status = coalesce(nullif(p->>'status',''),'borrador'), free_preview = coalesce((p->>'free_preview')::boolean,false)
    where id = (p->>'id')::uuid returning id into nid;
  end if;
  return nid;
end $$;
grant execute on function public.lib_save(jsonb) to authenticated;
create or replace function public.lib_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  delete from public.lib_items where id = p_id;
end $$;
grant execute on function public.lib_delete(uuid) to authenticated;

-- un video con su enlace, solo para quien tiene la biblioteca (o si es de muestra)
create or replace function public.lib_item(p_id uuid)
returns table (id uuid, title text, descr text, section text, video_url text, minutes int, sort int, free_preview boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.descr, i.section, i.video_url, i.minutes, i.sort, i.free_preview
  from public.lib_items i
  where i.id = p_id and (i.status = 'publicado' or public.is_admin())
    and (public.lib_ok() or (i.free_preview and auth.uid() is not null))
$$;
grant execute on function public.lib_item(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- tiempo visto (para "quién ve qué" y "cuántas horas")
-- ---------------------------------------------------------------------
create table if not exists public.lib_watch (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.lib_items(id) on delete cascade,
  seconds int not null default 0,
  last_pos int not null default 0,
  done boolean not null default false,
  first_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.lib_watch enable row level security;
drop policy if exists "biblioteca: mi avance" on public.lib_watch;
create policy "biblioteca: mi avance" on public.lib_watch for select using (user_id = auth.uid() or public.is_admin());

-- suma segundos vistos; se marca "visto" al llegar al 80% de la duración
create or replace function public.lib_add_watch(p_item uuid, p_secs int, p_pos int default 0, p_dur int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare mins int;
begin
  if auth.uid() is null or not (public.lib_ok() or exists (select 1 from public.lib_items where id = p_item and free_preview)) then return; end if;
  p_secs := greatest(0, least(coalesce(p_secs,0), 180));
  select minutes into mins from public.lib_items where id = p_item;
  if mins is null and coalesce(p_dur,0) > 30 then update public.lib_items set minutes = greatest(1, round(p_dur / 60.0)) where id = p_item; mins := greatest(1, round(p_dur / 60.0)); end if;
  insert into public.lib_watch (user_id, item_id, seconds, last_pos) values (auth.uid(), p_item, p_secs, greatest(0, coalesce(p_pos,0)))
  on conflict (user_id, item_id) do update set seconds = public.lib_watch.seconds + excluded.seconds,
    last_pos = case when excluded.last_pos > 0 then excluded.last_pos else public.lib_watch.last_pos end, updated_at = now();
  update public.lib_watch set done = true
  where user_id = auth.uid() and item_id = p_item and not done and mins is not null and seconds >= mins * 60 * 0.8;
end $$;
grant execute on function public.lib_add_watch(uuid,int,int,int) to authenticated;

-- marcar como visto a mano (por si lo vio en otro lado)
create or replace function public.lib_mark(p_item uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lib_ok() then return; end if;
  -- para marcarlo como visto hay que haber visto al menos la mitad (así el bono de la clase es justo)
  if coalesce(p_done,true) and not public.is_admin() and exists (select 1 from public.lib_items i where i.id = p_item and i.minutes is not null)
     and coalesce((select w.seconds from public.lib_watch w where w.user_id = auth.uid() and w.item_id = p_item),0) < (select i.minutes from public.lib_items i where i.id = p_item) * 60 * 0.5 then
    raise exception 'Mira al menos la mitad del video para marcarlo como visto.';
  end if;
  insert into public.lib_watch (user_id, item_id, done) values (auth.uid(), p_item, coalesce(p_done,true))
  on conflict (user_id, item_id) do update set done = coalesce(p_done,true), updated_at = now();
end $$;
grant execute on function public.lib_mark(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- calificación por video (1 a 5 estrellas + comentario opcional)
-- ---------------------------------------------------------------------
create table if not exists public.lib_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.lib_items(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  note text not null default '' check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.lib_ratings enable row level security;
drop policy if exists "biblioteca: mis notas" on public.lib_ratings;
create policy "biblioteca: mis notas" on public.lib_ratings for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.lib_rate(p_item uuid, p_stars int, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lib_ok() then raise exception 'Necesitas la biblioteca para calificar.'; end if;
  if p_stars not between 1 and 5 then raise exception 'Calificación inválida.'; end if;
  insert into public.lib_ratings (user_id, item_id, stars, note) values (auth.uid(), p_item, p_stars, left(coalesce(p_note,''),500))
  on conflict (user_id, item_id) do update set stars = excluded.stars, note = excluded.note, updated_at = now();
end $$;
grant execute on function public.lib_rate(uuid,int,text) to authenticated;

-- ---------------------------------------------------------------------
-- preguntas por video (las ven todos los que tienen la biblioteca; el profe responde)
-- ---------------------------------------------------------------------
create table if not exists public.lib_questions (
  id bigserial primary key,
  item_id uuid not null references public.lib_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1500),
  minute int check (minute is null or minute between 0 and 1000),
  answer text check (answer is null or char_length(answer) <= 3000),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lib_questions_item_idx on public.lib_questions (item_id, created_at desc);
alter table public.lib_questions enable row level security;
drop policy if exists "biblioteca: preguntas" on public.lib_questions;
create policy "biblioteca: preguntas" on public.lib_questions for select using (public.lib_ok());

create or replace function public.lib_ask(p_item uuid, p_body text, p_minute int default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare n int; nid bigint;
begin
  if not public.lib_ok() then raise exception 'Necesitas la biblioteca para preguntar.'; end if;
  select count(*) into n from public.lib_questions where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if n >= 10 and not public.is_admin() then raise exception 'Ya hiciste varias preguntas. Espera un rato.'; end if;
  insert into public.lib_questions (item_id, user_id, body, minute) values (p_item, auth.uid(), trim(p_body), p_minute) returning id into nid;
  return nid;
end $$;
grant execute on function public.lib_ask(uuid,text,int) to authenticated;

create or replace function public.lib_answer(p_id bigint, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  update public.lib_questions set answer = nullif(trim(coalesce(p_answer,'')),''), answered_at = case when nullif(trim(coalesce(p_answer,'')),'') is null then null else now() end where id = p_id;
end $$;
grant execute on function public.lib_answer(bigint,text) to authenticated;

create or replace function public.lib_q_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.lib_questions where id = p_id and (user_id = auth.uid() or public.is_admin());
end $$;
grant execute on function public.lib_q_delete(bigint) to authenticated;

-- preguntas de un video, con nombre de quien pregunta
create or replace function public.lib_qs(p_item uuid)
returns table (id bigint, user_id uuid, username text, avatar_url text, body text, minute int, answer text, answered_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.user_id, p.username, p.avatar_url, q.body, q.minute, q.answer, q.answered_at, q.created_at
  from public.lib_questions q join public.profiles p on p.id = q.user_id
  where q.item_id = p_item and public.lib_ok()
  order by q.created_at desc limit 200
$$;
grant execute on function public.lib_qs(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- resumen para el alumno: avance, nota promedio de cada video, su nota
-- ---------------------------------------------------------------------
create or replace function public.lib_overview()
returns table (item_id uuid, my_seconds int, my_done boolean, my_pos int, my_stars int, avg_stars numeric, n_ratings int, n_questions int)
language sql stable security definer set search_path = public as $$
  select i.id,
    coalesce(w.seconds,0), coalesce(w.done,false), coalesce(w.last_pos,0), r.stars,
    (select round(avg(stars)::numeric,1) from public.lib_ratings x where x.item_id = i.id),
    (select count(*)::int from public.lib_ratings x where x.item_id = i.id),
    (select count(*)::int from public.lib_questions q where q.item_id = i.id)
  from public.lib_items i
  left join public.lib_watch w on w.item_id = i.id and w.user_id = auth.uid()
  left join public.lib_ratings r on r.item_id = i.id and r.user_id = auth.uid()
  where i.status = 'publicado' and auth.uid() is not null
$$;
grant execute on function public.lib_overview() to authenticated;

-- ---------------------------------------------------------------------
-- clase personalizada de 2 horas (bono de la biblioteca)
-- ---------------------------------------------------------------------
create table if not exists public.lib_class_req (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  status text not null default 'pendiente' check (status in ('pendiente','agendada','hecha','cancelada')),
  availability text not null default '' check (char_length(availability) <= 500),
  topics text not null default '' check (char_length(topics) <= 2000),
  contact text not null default '' check (char_length(contact) <= 120),
  scheduled_at timestamptz,
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  pct int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lib_class_req enable row level security;
drop policy if exists "biblioteca: mi clase" on public.lib_class_req;
create policy "biblioteca: mi clase" on public.lib_class_req for select using (user_id = auth.uid() or public.is_admin());

-- % de la biblioteca que ya vio (videos marcados como vistos / videos publicados)
create or replace function public.lib_pct(p_user uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(round(100.0 * (select count(*) from public.lib_watch w join public.lib_items i on i.id = w.item_id and i.status = 'publicado'
                                   where w.user_id = coalesce(p_user, auth.uid()) and w.done)
                        / nullif((select count(*) from public.lib_items where status = 'publicado'),0))::int, 0)
$$;
grant execute on function public.lib_pct(uuid) to authenticated;

create or replace function public.lib_request_class(p_availability text, p_topics text, p_contact text) returns void
language plpgsql security definer set search_path = public as $$
declare need int; pc int;
begin
  if not public.lib_ok() then raise exception 'La clase personalizada es para quien tiene la biblioteca.'; end if;
  need := coalesce(nullif((select data->'lib'->>'minPct' from public.site_settings limit 1),'')::int, 80);
  pc := public.lib_pct();
  if pc < need and not public.is_admin() then raise exception '%', format('Primero mira al menos el %s%% de la biblioteca (llevas %s%%).', need, pc); end if;
  insert into public.lib_class_req (user_id, availability, topics, contact, pct)
  values (auth.uid(), left(coalesce(p_availability,''),500), left(coalesce(p_topics,''),2000), left(coalesce(p_contact,''),120), pc)
  on conflict (user_id) do update set availability = excluded.availability, topics = excluded.topics, contact = excluded.contact, pct = excluded.pct, updated_at = now()
  where public.lib_class_req.status in ('pendiente','cancelada');
end $$;
grant execute on function public.lib_request_class(text,text,text) to authenticated;

-- admin: cambiar estado / agendar
create or replace function public.lib_class_set(p_id bigint, p_status text, p_at timestamptz, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  update public.lib_class_req set status = coalesce(p_status, status), scheduled_at = p_at, admin_note = left(coalesce(p_note,''),1000), updated_at = now() where id = p_id;
end $$;
grant execute on function public.lib_class_set(bigint,text,timestamptz,text) to authenticated;

-- ---------------------------------------------------------------------
-- admin: estadísticas
-- ---------------------------------------------------------------------
-- por video: cuántos lo vieron, horas, terminados, nota y preguntas
create or replace function public.lib_admin_items()
returns table (item_id uuid, title text, section text, status text, minutes int, viewers int, done int, hours numeric, avg_stars numeric, n_ratings int, n_questions int, open_questions int)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.section, i.status, i.minutes,
    (select count(*)::int from public.lib_watch w where w.item_id = i.id and w.seconds > 30),
    (select count(*)::int from public.lib_watch w where w.item_id = i.id and w.done),
    (select round(coalesce(sum(w.seconds),0)/3600.0,1) from public.lib_watch w where w.item_id = i.id),
    (select round(avg(stars)::numeric,1) from public.lib_ratings r where r.item_id = i.id),
    (select count(*)::int from public.lib_ratings r where r.item_id = i.id),
    (select count(*)::int from public.lib_questions q where q.item_id = i.id),
    (select count(*)::int from public.lib_questions q where q.item_id = i.id and q.answer is null)
  from public.lib_items i where public.is_admin()
  order by i.sort, i.created_at
$$;
grant execute on function public.lib_admin_items() to authenticated;

-- por alumno: quién tiene la biblioteca y cuánto ha visto
create or replace function public.lib_admin_users()
returns table (user_id uuid, username text, avatar_url text, since timestamptz, hours numeric, done int, total int, pct int, last_at timestamptz, class_status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_url, uc.created_at,
    (select round(coalesce(sum(w.seconds),0)/3600.0,1) from public.lib_watch w where w.user_id = p.id),
    (select count(*)::int from public.lib_watch w join public.lib_items i on i.id = w.item_id and i.status = 'publicado' where w.user_id = p.id and w.done),
    (select count(*)::int from public.lib_items where status = 'publicado'),
    public.lib_pct(p.id),
    (select max(w.updated_at) from public.lib_watch w where w.user_id = p.id),
    (select c.status from public.lib_class_req c where c.user_id = p.id)
  from public.user_courses uc join public.profiles p on p.id = uc.user_id
  where public.is_admin() and uc.course_id = public.lib_course()
  order by 5 desc nulls last
$$;
grant execute on function public.lib_admin_users() to authenticated;

-- preguntas sin responder (todas) para el admin
create or replace function public.lib_admin_questions(p_open boolean default true)
returns table (id bigint, item_id uuid, item_title text, username text, body text, minute int, answer text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select q.id, q.item_id, i.title, p.username, q.body, q.minute, q.answer, q.created_at
  from public.lib_questions q join public.lib_items i on i.id = q.item_id join public.profiles p on p.id = q.user_id
  where public.is_admin() and (not p_open or q.answer is null)
  order by q.created_at desc limit 300
$$;
grant execute on function public.lib_admin_questions(boolean) to authenticated;

-- solicitudes de clase para el admin
create or replace function public.lib_admin_classes()
returns table (id bigint, user_id uuid, username text, avatar_url text, status text, availability text, topics text, contact text, scheduled_at timestamptz, admin_note text, pct int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.user_id, p.username, p.avatar_url, c.status, c.availability, c.topics, c.contact, c.scheduled_at, c.admin_note, public.lib_pct(c.user_id), c.created_at
  from public.lib_class_req c join public.profiles p on p.id = c.user_id
  where public.is_admin()
  order by (c.status = 'pendiente') desc, c.created_at desc
$$;
grant execute on function public.lib_admin_classes() to authenticated;

-- ---------------------------------------------------------------------
-- PAGOS: qué se puede comprar (Admin → Pagos → "Qué se puede comprar")
--   site_settings.data.paymentsOff = true  → nadie puede pagar nada
--   site_settings.data.sell.plans / sell."c:<id del curso>" / sell.lib = false → eso no se vende
-- (reemplaza la función del archivo pagos_pausa.sql; el trigger sigue igual)
-- ---------------------------------------------------------------------
create or replace function public.payment_requests_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb; k text;
begin
  select data into d from public.site_settings where id = 1;
  if not public.is_admin() and coalesce((d->>'paymentsOff')::boolean, false) then
    raise exception 'Los pagos están pausados por ahora. Te avisaremos cuando abran.';
  end if;
  k := case when new.course_id is null then 'plans' when new.course_id = public.lib_course() then 'lib' else 'c:' || new.course_id::text end;
  if not public.is_admin() and (d->'sell'->>k) = 'false' then
    raise exception 'Esto no está a la venta por ahora. Te avisaremos cuando abra.';
  end if;
  if (select count(*) from public.payment_requests where user_id = new.user_id and status = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 pagos por confirmar. Espera a que los revisemos.';
  end if;
  return new;
end $$;
drop trigger if exists payment_requests_limit on public.payment_requests;
create trigger payment_requests_limit before insert on public.payment_requests
  for each row execute function public.payment_requests_limit();
