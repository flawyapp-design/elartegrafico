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
