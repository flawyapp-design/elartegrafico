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
  kind text not null default 'text' check (kind in ('text','share','call','img')),
  payload jsonb,
  created_at timestamptz not null default now()
);
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
drop policy if exists "mis lecturas" on public.chart_reads;
create policy "mis lecturas" on public.chart_reads for select using (user_id = auth.uid());

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

alter table public.chart_msgs enable row level security;
drop policy if exists "leer mis salas" on public.chart_msgs;
create policy "leer mis salas" on public.chart_msgs for select
  using (public.chat_mine(room) and (room <> 'g:general' or public.chat_can() or public.is_admin()));
-- se escribe solo por chat_send (valida y frena el spam); no hay política de insert directa

-- ---------------------------------------------------------------------
-- enviar
-- ---------------------------------------------------------------------
create or replace function public.chat_send(p_room text, p_body text, p_kind text default 'text', p_payload jsonb default null)
returns public.chart_msgs language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); r public.chart_msgs; other uuid; n int;
begin
  if u is null then raise exception 'Ingresa con tu cuenta.'; end if;
  if not public.chat_can() then raise exception 'Tu chat está desactivado.'; end if;
  if p_kind not in ('text','share','call','img') then raise exception 'Tipo inválido.'; end if;
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

-- marcar leído
create or replace function public.chat_read(p_room text, p_last bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.chat_mine(p_room) then return; end if;
  insert into public.chart_reads (user_id, room, last_id) values (auth.uid(), p_room, coalesce(p_last,0))
  on conflict (user_id, room) do update set last_id = greatest(public.chart_reads.last_id, excluded.last_id);
end $$;
grant execute on function public.chat_read(text,bigint) to authenticated;

-- historial de una sala (con nombre y foto de quien escribe)
create or replace function public.chat_history(p_room text, p_before bigint default null, p_limit int default 50)
returns table (id bigint, room text, sender uuid, username text, avatar_url text, is_admin boolean, body text, kind text, payload jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.room, m.sender, p.username, p.avatar_url, (p.role = 'admin'), m.body, m.kind, m.payload, m.created_at
  from public.chart_msgs m join public.profiles p on p.id = m.sender
  where m.room = p_room and public.chat_mine(p_room)
    and (p_room <> 'g:general' or public.chat_can() or public.is_admin())
    and (p_before is null or m.id < p_before)
  order by m.id desc
  limit least(greatest(coalesce(p_limit,50),1),100)
$$;
grant execute on function public.chat_history(text,bigint,int) to authenticated;

-- mis conversaciones (privadas + el general) con no leídos
create or replace function public.chat_threads()
returns table (room text, other uuid, username text, avatar_url text, is_admin boolean, online boolean,
               last_id bigint, last_body text, last_kind text, last_sender uuid, last_at timestamptz, unread int)
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
         and x.id > coalesce((select last_id from public.chart_reads cr where cr.user_id = auth.uid() and cr.room = r.room), 0)
         and (r.room <> 'g:general' or x.created_at > now() - interval '3 days'))
  from rooms r
  left join public.profiles o on o.id = (case when r.room not like 'dm:%' then null when split_part(r.room,':',2) = auth.uid()::text then split_part(r.room,':',3) else split_part(r.room,':',2) end)::uuid
  left join lateral (select * from public.chart_msgs z where z.room = r.room order by z.id desc limit 1) l on true
  where auth.uid() is not null and (r.room <> 'g:general' or public.chat_can() or public.is_admin())
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
end $$;
