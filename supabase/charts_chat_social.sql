-- =====================================================================
-- EAG Charts · Chat interno (privado 1 a 1 y grupo general), conectados,
-- compartir gráfico y llamadas de voz (las llamadas van directo entre
-- navegadores; aquí solo se guardan los mensajes y las invitaciones).
-- Correr una vez en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

-- opciones del perfil: aparecer invisible y silenciado por el admin
alter table public.profiles add column if not exists chat_hidden boolean not null default false;
alter table public.profiles add column if not exists chat_blocked boolean not null default false;

-- ---------------------------------------------------------------------
-- mensajes
--   room = 'g:general'                     → grupo de todos
--   room = 'dm:<uuid menor>:<uuid mayor>'  → privado entre 2 personas
-- ---------------------------------------------------------------------
create table if not exists public.chart_msgs (
  id bigserial primary key,
  room text not null check (room = 'g:general' or room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  sender uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  kind text not null default 'text',
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.chart_msgs drop constraint if exists chart_msgs_kind_check;
alter table public.chart_msgs add constraint chart_msgs_kind_check check (kind in ('text','share','call','img','idea'));
create index if not exists chart_msgs_room_idx on public.chart_msgs (room, id desc);
create index if not exists chart_msgs_sender_idx on public.chart_msgs (sender, created_at desc);

-- última lectura de cada sala por usuario
create table if not exists public.chart_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  room text not null,
  last_id bigint not null default 0,
  primary key (user_id, room)
);
alter table public.chart_reads enable row level security;

-- chats borrados por cada uno (solo para esa persona): oculta todo hasta ese mensaje
create table if not exists public.chart_hidden (
  user_id uuid not null references auth.users(id) on delete cascade,
  room text not null,
  upto bigint not null default 0,
  primary key (user_id, room)
);
alter table public.chart_hidden enable row level security;
drop policy if exists "mis ocultos" on public.chart_hidden;
create policy "mis ocultos" on public.chart_hidden for select using (user_id = auth.uid());

-- fotos del chat de los charts: comprimidas, en el almacenamiento de archivos (no en la base de datos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chartchat', 'chartchat', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "chartchat lectura" on storage.objects;
create policy "chartchat lectura" on storage.objects for select using (bucket_id = 'chartchat');
drop policy if exists "chartchat sube" on storage.objects;
create policy "chartchat sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'chartchat' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "chartchat borra" on storage.objects;
create policy "chartchat borra" on storage.objects for delete using (bucket_id = 'chartchat' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ¿puede usar el chat?
create or replace function public.chat_can() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and not coalesce(p.banned,false) and not coalesce(p.chat_blocked,false))
$$;
grant execute on function public.chat_can() to authenticated;

-- ¿es una sala mía?
create or replace function public.chat_mine(p_room text) returns boolean
language sql stable as $$
  select auth.uid() is not null and (
    p_room = 'g:general'
    or (p_room like 'dm:%' and auth.uid()::text in (split_part(p_room,':',2), split_part(p_room,':',3))))
$$;
grant execute on function public.chat_mine(text) to authenticated;

drop policy if exists "mis lecturas" on public.chart_reads;
-- cada uno ve sus lecturas y, en los privados, hasta dónde leyó la otra persona ("Visto")
create policy "mis lecturas" on public.chart_reads for select using (user_id = auth.uid() or (room <> 'g:general' and public.chat_mine(room)));

alter table public.chart_msgs enable row level security;
drop policy if exists "leer mis salas" on public.chart_msgs;
create policy "leer mis salas" on public.chart_msgs for select
  using (public.chat_mine(room) and (room <> 'g:general' or public.chat_can() or public.is_admin()));
-- se escribe solo por chat_send (valida y frena el spam); no hay política de insert directa

-- reacciones (👍 🔥 😂 …): una por persona y emoji
create table if not exists public.chart_reacts (
  msg_id bigint not null references public.chart_msgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  room text not null,
  created_at timestamptz not null default now(),
  primary key (msg_id, user_id, emoji)
);
alter table public.chart_reacts enable row level security;
alter table public.chart_reacts replica identity full;
drop policy if exists "ver reacciones" on public.chart_reacts;
create policy "ver reacciones" on public.chart_reacts for select using (public.chat_mine(room));

create or replace function public.chat_react(p_id bigint, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
declare rm text;
begin
  if not public.chat_can() then raise exception 'Tu chat está desactivado.'; end if;
  select room into rm from public.chart_msgs where id = p_id;
  if rm is null or not public.chat_mine(rm) then raise exception 'Mensaje no disponible.'; end if;
  if p_emoji not in ('👍','🔥','😂','😮','🙏','💰','📈','📉','❤️') then raise exception 'Reacción no válida.'; end if;
  if exists (select 1 from public.chart_reacts where msg_id = p_id and user_id = auth.uid() and emoji = p_emoji) then
    delete from public.chart_reacts where msg_id = p_id and user_id = auth.uid() and emoji = p_emoji; return false;
  end if;
  insert into public.chart_reacts (msg_id, user_id, emoji, room) values (p_id, auth.uid(), p_emoji, rm); return true;
end $$;
grant execute on function public.chat_react(bigint,text) to authenticated;

-- ---------------------------------------------------------------------
-- enviar
-- ---------------------------------------------------------------------
create or replace function public.chat_send(p_room text, p_body text, p_kind text default 'text', p_payload jsonb default null)
returns public.chart_msgs language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); r public.chart_msgs; other uuid; n int;
begin
  if u is null then raise exception 'Ingresa con tu cuenta.'; end if;
  if not public.chat_can() then raise exception 'Tu chat está desactivado.'; end if;
  if p_kind not in ('text','share','call','img','idea') then raise exception 'Tipo inválido.'; end if;
  p_body := left(trim(coalesce(p_body,'')), 1000);
  if p_kind = 'text' and p_body = '' then raise exception 'Mensaje vacío.'; end if;
  if p_room = 'g:general' then
    if p_kind in ('share','call') and not public.is_admin() then raise exception 'Eso se hace por privado.'; end if;
  elsif p_room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    if u::text not in (split_part(p_room,':',2), split_part(p_room,':',3)) then raise exception 'Sala inválida.'; end if;
    if split_part(p_room,':',2) >= split_part(p_room,':',3) then raise exception 'Sala inválida.'; end if;
    other := (case when split_part(p_room,':',2) = u::text then split_part(p_room,':',3) else split_part(p_room,':',2) end)::uuid;
    if not exists (select 1 from public.profiles where id = other and not coalesce(banned,false)) then raise exception 'Esa persona no está disponible.'; end if;
  else
    raise exception 'Sala inválida.';
  end if;
  if p_payload is not null and length(p_payload::text) > 4000 then raise exception 'Mensaje muy grande.'; end if;
  -- las fotos solo pueden venir de tu carpeta del chat de los charts
  if p_kind = 'img' and coalesce(p_payload->>'url','') not like '%/storage/v1/object/public/chartchat/' || u::text || '/%' then raise exception 'Imagen no válida.'; end if;
  -- frenar spam: máximo 20 mensajes por minuto (el admin sin límite)
  if not public.is_admin() then
    select count(*) into n from public.chart_msgs where sender = u and created_at > now() - interval '1 minute';
    if n >= 20 then raise exception 'Vas muy rápido. Espera un momento.'; end if;
  end if;
  insert into public.chart_msgs (room, sender, body, kind, payload)
  values (p_room, u, p_body, p_kind, p_payload)
  returning * into r;
  insert into public.chart_reads (user_id, room, last_id) values (u, p_room, r.id)
  on conflict (user_id, room) do update set last_id = greatest(public.chart_reads.last_id, excluded.last_id);
  return r;
end $$;
grant execute on function public.chat_send(text,text,text,jsonb) to authenticated;

-- borrar: el autor o el admin
create or replace function public.chat_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chart_msgs where id = p_id and (sender = auth.uid() or public.is_admin());
end $$;
grant execute on function public.chat_delete(bigint) to authenticated;

-- borrar un chat (solo para ti): desaparece de tu lista hasta que llegue un mensaje nuevo
create or replace function public.chat_hide(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare mx bigint;
begin
  if auth.uid() is null or not public.chat_mine(p_room) then return; end if;
  select coalesce(max(id),0) into mx from public.chart_msgs where room = p_room;
  insert into public.chart_hidden (user_id, room, upto) values (auth.uid(), p_room, mx)
  on conflict (user_id, room) do update set upto = excluded.upto;
  perform public.chat_read(p_room, mx);
end $$;
grant execute on function public.chat_hide(text) to authenticated;

-- fotos viejas del chat de los charts (el admin las borra del almacenamiento)
create or replace function public.chartchat_img_old(p_days int default 60) returns setof text
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select o.name from storage.objects o
    where o.bucket_id = 'chartchat' and o.created_at < now() - make_interval(days => greatest(coalesce(p_days,60),7)) limit 1000;
end $$;
grant execute on function public.chartchat_img_old(int) to authenticated;

-- marcar leído
create or replace function public.chat_read(p_room text, p_last bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.chat_mine(p_room) then return; end if;
  insert into public.chart_reads (user_id, room, last_id) values (auth.uid(), p_room, coalesce(p_last,0))
  on conflict (user_id, room) do update set last_id = greatest(public.chart_reads.last_id, excluded.last_id);
end $$;
grant execute on function public.chat_read(text,bigint) to authenticated;

-- historial de una sala (con nombre, foto y reacciones)
drop function if exists public.chat_history(text,bigint,int);
create or replace function public.chat_history(p_room text, p_before bigint default null, p_limit int default 50)
returns table (id bigint, room text, sender uuid, username text, avatar_url text, is_admin boolean, body text, kind text, payload jsonb, created_at timestamptz, reacts jsonb)
language sql stable security definer set search_path = public as $$
  select m.id, m.room, m.sender, p.username, p.avatar_url, (p.role = 'admin'), m.body, m.kind, m.payload, m.created_at,
    (select jsonb_object_agg(e.emoji, e.users) from (select r.emoji, jsonb_agg(r.user_id) users from public.chart_reacts r where r.msg_id = m.id group by r.emoji) e)
  from public.chart_msgs m join public.profiles p on p.id = m.sender
  where m.room = p_room and public.chat_mine(p_room)
    and (p_room <> 'g:general' or public.chat_can() or public.is_admin())
    and (p_before is null or m.id < p_before)
    and m.id > coalesce((select h.upto from public.chart_hidden h where h.user_id = auth.uid() and h.room = p_room), 0)
  order by m.id desc
  limit least(greatest(coalesce(p_limit,50),1),100)
$$;
grant execute on function public.chat_history(text,bigint,int) to authenticated;

-- mis conversaciones (privadas + el general) con no leídos y hasta dónde leyó la otra persona
drop function if exists public.chat_threads();
create or replace function public.chat_threads()
returns table (room text, other uuid, username text, avatar_url text, is_admin boolean, online boolean,
               last_id bigint, last_body text, last_kind text, last_sender uuid, last_at timestamptz, unread int, other_read bigint)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct m.room from public.chart_msgs m
    where m.room like 'dm:%' and auth.uid()::text in (split_part(m.room,':',2), split_part(m.room,':',3))
  ), rooms as (
    select room from mine union select 'g:general'
  )
  select r.room,
    o.id, o.username, o.avatar_url, (o.role = 'admin'),
    exists (select 1 from public.chart_presence c where c.user_id = o.id and c.last_seen > now() - interval '90 seconds') and not coalesce(o.chat_hidden,false),
    l.id, l.body, l.kind, l.sender, l.created_at,
    (select count(*)::int from public.chart_msgs x
       where x.room = r.room and x.sender <> auth.uid()
         and x.id > greatest(coalesce((select last_id from public.chart_reads cr where cr.user_id = auth.uid() and cr.room = r.room), 0),
                             coalesce((select h.upto from public.chart_hidden h where h.user_id = auth.uid() and h.room = r.room), 0))
         and (r.room <> 'g:general' or x.created_at > now() - interval '3 days')),
    (select cr.last_id from public.chart_reads cr where cr.room = r.room and cr.user_id = o.id)
  from rooms r
  left join public.profiles o on o.id = (case when r.room not like 'dm:%' then null when split_part(r.room,':',2) = auth.uid()::text then split_part(r.room,':',3) else split_part(r.room,':',2) end)::uuid
  left join lateral (select * from public.chart_msgs z where z.room = r.room order by z.id desc limit 1) l on true
  where auth.uid() is not null and (r.room <> 'g:general' or public.chat_can() or public.is_admin())
    and (r.room = 'g:general' or l.id > coalesce((select h.upto from public.chart_hidden h where h.user_id = auth.uid() and h.room = r.room), 0))
  order by l.id desc nulls last
$$;
grant execute on function public.chat_threads() to authenticated;

-- conectados ahora en EAG Charts (los invisibles no salen, salvo para el admin)
create or replace function public.chat_people()
returns table (id uuid, username text, avatar_url text, is_admin boolean, symbol text, symbol_name text, tf text, hidden boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_url, (p.role = 'admin'), c.symbol, c.symbol_name, c.tf, coalesce(p.chat_hidden,false)
  from public.chart_presence c join public.profiles p on p.id = c.user_id
  where auth.uid() is not null and c.last_seen > now() - interval '90 seconds' and not coalesce(p.banned,false)
    and (not coalesce(p.chat_hidden,false) or p.id = auth.uid() or public.is_admin())
  order by (p.role = 'admin') desc, p.username
  limit 300
$$;
grant execute on function public.chat_people() to authenticated;

-- buscar a alguien por usuario (para escribirle aunque no esté conectado)
create or replace function public.chat_find(p_q text)
returns table (id uuid, username text, avatar_url text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_url, (p.role = 'admin')
  from public.profiles p
  where auth.uid() is not null and length(trim(coalesce(p_q,''))) >= 2 and not coalesce(p.banned,false)
    and p.username ilike '%' || replace(replace(trim(p_q),'%',''),'_','\_') || '%'
  order by (lower(p.username) = lower(trim(p_q))) desc, length(p.username)
  limit 15
$$;
grant execute on function public.chat_find(text) to authenticated;

-- aparecer invisible
create or replace function public.chat_set_hidden(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set chat_hidden = coalesce(p_on,false) where id = auth.uid();
$$;
grant execute on function public.chat_set_hidden(boolean) to authenticated;

-- admin: silenciar / reactivar el chat de alguien
create or replace function public.chat_block(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  update public.profiles set chat_blocked = coalesce(p_on,false) where id = p_user;
end $$;
grant execute on function public.chat_block(uuid,boolean) to authenticated;

-- limpieza: el grupo general guarda 30 días; los privados 180 días
create or replace function public.chat_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from public.chart_msgs where (room = 'g:general' and created_at < now() - interval '30 days')
                                   or (room <> 'g:general' and created_at < now() - interval '180 days');
$$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('chat-cleanup') where exists (select 1 from cron.job where jobname = 'chat-cleanup');
    perform cron.schedule('chat-cleanup', '40 8 * * *', 'select public.chat_cleanup()');
  end if;
end $$;

-- mensajes nuevos al instante (Supabase Realtime respeta los permisos de lectura)
do $$ begin
  begin alter publication supabase_realtime add table public.chart_msgs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chart_reacts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chart_reads; exception when duplicate_object then null; end;
end $$;
