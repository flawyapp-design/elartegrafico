-- EAG Charts · Más grupos de chat (quién los ve y quién no) + @todos con aviso fuerte.
-- Ya incluye lo de chat_audios.sql (notas de voz). Se puede correr varias veces sin dañar nada.

-- ============ grupos ============
create table if not exists public.chart_groups (
  id text primary key check (id ~ '^g:[a-z0-9-]{2,30}$' and id <> 'g:general'),
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '👥',
  descr text not null default '',
  who text not null default 'all' check (who in ('all','plan','verified','list','admins')),
  plans text[] not null default '{}',
  members uuid[] not null default '{}',
  only_admin boolean not null default false,   -- solo el admin escribe (tipo canal de avisos)
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.chart_groups enable row level security;

-- ¿esta persona puede ver este grupo?
create or replace function public.chat_group_ok_for(p_user uuid, p_room text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    p_room = 'g:general'
    or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
    or exists (
      select 1 from public.chart_groups g join public.profiles p on p.id = p_user
      where g.id = p_room and not coalesce(p.banned,false) and (
        p_user = any(g.members)
        or g.who = 'all'
        or (g.who = 'plan' and p.premium_until > now() and lower(coalesce(p.plan,'')) = any(g.plans))
        or (g.who = 'verified' and coalesce(p.affiliate,false))
      )))
$$;
create or replace function public.chat_group_ok(p_room text) returns boolean
language sql stable security definer set search_path = public as $$ select public.chat_group_ok_for(auth.uid(), p_room) $$;
grant execute on function public.chat_group_ok(text) to authenticated;

drop policy if exists "ver mis grupos" on public.chart_groups;
create policy "ver mis grupos" on public.chart_groups for select using (public.chat_group_ok(id));

-- las salas que son "mías": el general, los grupos que puedo ver y mis privados
create or replace function public.chat_mine(p_room text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_room = 'g:general'
    or (p_room like 'g:%' and public.chat_group_ok(p_room))
    or (p_room like 'dm:%' and auth.uid()::text in (split_part(p_room,':',2), split_part(p_room,':',3))))
$$;
grant execute on function public.chat_mine(text) to authenticated;

-- la sala puede ser un grupo nuevo
alter table public.chart_msgs drop constraint if exists chart_msgs_room_check;
alter table public.chart_msgs add constraint chart_msgs_room_check check (room ~ '^g:[a-z0-9-]{2,30}$' or room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$');
alter table public.chart_msgs drop constraint if exists chart_msgs_kind_check;
alter table public.chart_msgs add constraint chart_msgs_kind_check check (kind in ('text','share','call','img','idea','audio'));

drop policy if exists "leer mis salas" on public.chart_msgs;
create policy "leer mis salas" on public.chart_msgs for select
  using (public.chat_mine(room) and (room not like 'g:%' or public.chat_can() or public.is_admin()));
drop policy if exists "mis lecturas" on public.chart_reads;
create policy "mis lecturas" on public.chart_reads for select using (user_id = auth.uid() or public.chat_mine(room));

-- lista de grupos que veo (el general primero)
create or replace function public.chat_groups()
returns table (id text, name text, emoji text, descr text, who text, plans text[], members uuid[], only_admin boolean, sort int, n_members int)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.emoji, g.descr, g.who,
    (case when public.is_admin() then g.plans else '{}' end), (case when public.is_admin() then g.members else '{}' end),
    g.only_admin, g.sort,
    (case when public.is_admin() then (select count(*)::int from public.profiles p where not coalesce(p.banned,false) and public.chat_group_ok_for(p.id, g.id)) end)
  from public.chart_groups g
  where public.chat_group_ok(g.id)
  order by g.sort, g.created_at
$$;
grant execute on function public.chat_groups() to authenticated;

-- admin: crear / editar / borrar grupos y ver quién lo ve
create or replace function public.chat_group_save(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare gid text := coalesce(nullif(p->>'id',''), 'g:' || left(regexp_replace(lower(coalesce(p->>'name','grupo')), '[^a-z0-9]+', '-', 'g'), 20) || '-' || substr(md5(random()::text),1,4));
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  gid := regexp_replace(gid, '-+$', '');
  insert into public.chart_groups (id, name, emoji, descr, who, plans, members, only_admin, sort)
  values (gid, left(coalesce(nullif(trim(p->>'name'),''),'Grupo'),40), left(coalesce(nullif(p->>'emoji',''),'👥'),8), left(coalesce(p->>'descr',''),200),
          coalesce(nullif(p->>'who',''),'all'),
          coalesce((select array_agg(lower(x)) from jsonb_array_elements_text(coalesce(p->'plans','[]'::jsonb)) x), '{}'),
          coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'members','[]'::jsonb)) x), '{}'),
          coalesce((p->>'only_admin')::boolean,false), coalesce((p->>'sort')::int,0))
  on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, descr = excluded.descr, who = excluded.who,
    plans = excluded.plans, members = excluded.members, only_admin = excluded.only_admin, sort = excluded.sort;
  return gid;
end $$;
grant execute on function public.chat_group_save(jsonb) to authenticated;

create or replace function public.chat_group_delete(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el admin.'; end if;
  if p_id = 'g:general' then raise exception 'El grupo general no se borra.'; end if;
  delete from public.chart_msgs where room = p_id;
  delete from public.chart_reads where room = p_id;
  delete from public.chart_groups where id = p_id;
end $$;
grant execute on function public.chat_group_delete(text) to authenticated;

create or replace function public.chat_group_people(p_id text)
returns table (id uuid, username text, avatar_url text, plan text, verified boolean, ok boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_url, (case when p.premium_until > now() then lower(p.plan) end), coalesce(p.affiliate,false), public.chat_group_ok_for(p.id, p_id)
  from public.profiles p
  where public.is_admin() and not coalesce(p.banned,false)
  order by public.chat_group_ok_for(p.id, p_id) desc, p.username
  limit 1000
$$;
grant execute on function public.chat_group_people(text) to authenticated;

-- ============ enviar (grupos, notas de voz, canal solo admin) ============
create or replace function public.chat_send(p_room text, p_body text, p_kind text default 'text', p_payload jsonb default null)
returns public.chart_msgs language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); r public.chart_msgs; other uuid; n int;
begin
  if u is null then raise exception 'Ingresa con tu cuenta.'; end if;
  if not public.chat_can() then raise exception 'Tu chat está desactivado.'; end if;
  if p_kind not in ('text','share','call','img','idea','audio') then raise exception 'Tipo inválido.'; end if;
  p_body := left(trim(coalesce(p_body,'')), 1000);
  if p_kind = 'text' and p_body = '' then raise exception 'Mensaje vacío.'; end if;
  if p_room like 'g:%' then
    if not public.chat_group_ok(p_room) then raise exception 'No tienes acceso a ese grupo.'; end if;
    if p_kind in ('share','call') and not public.is_admin() then raise exception 'Eso se hace por privado.'; end if;
    if exists (select 1 from public.chart_groups g where g.id = p_room and g.only_admin) and not public.is_admin() then raise exception 'En este grupo solo escribe el profe.'; end if;
  elsif p_room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    if u::text not in (split_part(p_room,':',2), split_part(p_room,':',3)) then raise exception 'Sala inválida.'; end if;
    if split_part(p_room,':',2) >= split_part(p_room,':',3) then raise exception 'Sala inválida.'; end if;
    other := (case when split_part(p_room,':',2) = u::text then split_part(p_room,':',3) else split_part(p_room,':',2) end)::uuid;
    if not exists (select 1 from public.profiles where id = other and not coalesce(banned,false)) then raise exception 'Esa persona no está disponible.'; end if;
  else
    raise exception 'Sala inválida.';
  end if;
  if p_payload is not null and length(p_payload::text) > 4000 then raise exception 'Mensaje muy grande.'; end if;
  if p_kind in ('img','audio') and coalesce(p_payload->>'url','') not like '%/storage/v1/object/public/chartchat/' || u::text || '/%' then raise exception 'Archivo no válido.'; end if;
  if not public.is_admin() then
    select count(*) into n from public.chart_msgs where sender = u and created_at > now() - interval '1 minute';
    if n >= 20 then raise exception 'Vas muy rápido. Espera un momento.'; end if;
  end if;
  insert into public.chart_msgs (room, sender, body, kind, payload) values (p_room, u, p_body, p_kind, p_payload) returning * into r;
  insert into public.chart_reads (user_id, room, last_id) values (u, p_room, r.id)
  on conflict (user_id, room) do update set last_id = greatest(public.chart_reads.last_id, excluded.last_id);
  return r;
end $$;
grant execute on function public.chat_send(text,text,text,jsonb) to authenticated;

-- historial: cualquier grupo que puedas ver
drop function if exists public.chat_history(text,bigint,int);
create or replace function public.chat_history(p_room text, p_before bigint default null, p_limit int default 50)
returns table (id bigint, room text, sender uuid, username text, avatar_url text, is_admin boolean, body text, kind text, payload jsonb, created_at timestamptz, reacts jsonb, verified boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.room, m.sender, p.username, p.avatar_url, (p.role = 'admin'), m.body, m.kind, m.payload, m.created_at,
    (select jsonb_object_agg(e.emoji, e.users) from (select r.emoji, jsonb_agg(r.user_id) users from public.chart_reacts r where r.msg_id = m.id group by r.emoji) e),
    (case when public.is_admin() then coalesce(p.affiliate,false) end)
  from public.chart_msgs m join public.profiles p on p.id = m.sender
  where m.room = p_room and public.chat_mine(p_room)
    and (p_room not like 'g:%' or public.chat_can() or public.is_admin())
    and (p_before is null or m.id < p_before)
    and m.id > coalesce((select h.upto from public.chart_hidden h where h.user_id = auth.uid() and h.room = p_room), 0)
  order by m.id desc
  limit least(greatest(coalesce(p_limit,50),1),100)
$$;
grant execute on function public.chat_history(text,bigint,int) to authenticated;

-- mis conversaciones: privados + general + mis grupos
drop function if exists public.chat_threads();
create or replace function public.chat_threads()
returns table (room text, other uuid, username text, avatar_url text, is_admin boolean, online boolean,
               last_id bigint, last_body text, last_kind text, last_sender uuid, last_at timestamptz, unread int, other_read bigint, verified boolean, plan text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct m.room from public.chart_msgs m
    where m.room like 'dm:%' and auth.uid()::text in (split_part(m.room,':',2), split_part(m.room,':',3))
  ), rooms as (
    select room from mine union select 'g:general' union select g.id from public.chart_groups g where public.chat_group_ok(g.id)
  )
  select r.room,
    o.id, o.username, o.avatar_url, (o.role = 'admin'),
    exists (select 1 from public.chart_presence c where c.user_id = o.id and c.last_seen > now() - interval '90 seconds') and not coalesce(o.chat_hidden,false),
    l.id, l.body, l.kind, l.sender, l.created_at,
    (select count(*)::int from public.chart_msgs x
       where x.room = r.room and x.sender <> auth.uid()
         and x.id > greatest(coalesce((select last_id from public.chart_reads cr where cr.user_id = auth.uid() and cr.room = r.room), 0),
                             coalesce((select h.upto from public.chart_hidden h where h.user_id = auth.uid() and h.room = r.room), 0))
         and (r.room not like 'g:%' or x.created_at > now() - interval '10 days')),
    (select cr.last_id from public.chart_reads cr where cr.room = r.room and cr.user_id = o.id),
    (case when public.is_admin() and o.id is not null then coalesce(o.affiliate,false) end),
    (case when public.is_admin() and o.premium_until > now() then lower(o.plan) end)
  from rooms r
  left join public.profiles o on o.id = (case when r.room not like 'dm:%' then null when split_part(r.room,':',2) = auth.uid()::text then split_part(r.room,':',3) else split_part(r.room,':',2) end)::uuid
  left join lateral (select * from public.chart_msgs z where z.room = r.room order by z.id desc limit 1) l on true
  where auth.uid() is not null and (r.room not like 'g:%' or public.chat_can() or public.is_admin())
    and (r.room like 'g:%' or l.id > coalesce((select h.upto from public.chart_hidden h where h.user_id = auth.uid() and h.room = r.room), 0))
  order by l.id desc nulls last
$$;
grant execute on function public.chat_threads() to authenticated;

-- "Visto por" en cualquier grupo
drop function if exists public.chat_group_reads(bigint);
create or replace function public.chat_group_reads(p_min bigint default 0, p_room text default 'g:general')
returns table(user_id uuid, username text, avatar_url text, last_id bigint)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.username, p.avatar_url, r.last_id
  from public.chart_reads r join public.profiles p on p.id = r.user_id
  where auth.uid() is not null and r.room = coalesce(p_room,'g:general') and r.room like 'g:%' and public.chat_mine(r.room) and r.last_id >= coalesce(p_min, 0)
  order by r.last_id desc
  limit 500
$$;
revoke execute on function public.chat_group_reads(bigint,text) from public, anon;
grant execute on function public.chat_group_reads(bigint,text) to authenticated;

-- ============ @menciones y @todos ============
alter table public.chart_mentions add column if not exists everyone boolean not null default false;
create or replace function public.chart_msgs_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  if new.room not like 'g:%' or position('@' in coalesce(new.body,'')) = 0 then return new; end if;
  select (role = 'admin') into adm from public.profiles where id = new.sender;
  -- @todos (o @todas / @everyone): solo el admin; le llega a todos los que ven el grupo
  if coalesce(adm,false) and new.body ~* '(^|\s)@(todos|todas|everyone)(\s|$|[[:punct:]])' then
    insert into public.chart_mentions (user_id, msg_id, sender, everyone)
    select p.id, new.id, new.sender, true from public.profiles p
    where p.id <> new.sender and not coalesce(p.banned,false) and not coalesce(p.chat_blocked,false) and public.chat_group_ok_for(p.id, new.room)
    on conflict do nothing;
  end if;
  insert into public.chart_mentions (user_id, msg_id, sender)
  select p.id, new.id, new.sender
  from (select distinct lower(m[1]) as n from regexp_matches(new.body, '@([[:alnum:]_.\-]{2,40})', 'g') as m limit 20) t
  join public.profiles p on lower(p.username) = t.n
  where p.id <> new.sender and public.chat_group_ok_for(p.id, new.room)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists chart_msgs_mentions_t on public.chart_msgs;
create trigger chart_msgs_mentions_t after insert on public.chart_msgs for each row execute function public.chart_msgs_mentions();

drop function if exists public.chat_my_mentions();
create or replace function public.chat_my_mentions() returns table(id bigint, msg_id bigint, sender uuid, username text, body text, created_at timestamptz, room text, everyone boolean)
language sql stable security definer set search_path = public as $$
  select x.id, x.msg_id, x.sender, p.username, left(m.body, 200), m.created_at, m.room, x.everyone
  from public.chart_mentions x join public.chart_msgs m on m.id = x.msg_id join public.profiles p on p.id = x.sender
  where x.user_id = auth.uid() and not x.seen and m.created_at > now() - interval '7 days'
  order by x.id desc limit 20
$$;
revoke execute on function public.chat_my_mentions() from public, anon;
grant execute on function public.chat_my_mentions() to authenticated;

-- notas de voz: el bucket acepta audio (por si no corriste chat_audios.sql)
update storage.buckets
   set file_size_limit = greatest(coalesce(file_size_limit,0), 3145728),
       allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/aac','audio/mpeg','audio/ogg','audio/x-m4a']
 where id = 'chartchat';

-- avisos al instante de cambios en grupos
do $$ begin
  begin alter publication supabase_realtime add table public.chart_groups; exception when duplicate_object then null; end;
end $$;
