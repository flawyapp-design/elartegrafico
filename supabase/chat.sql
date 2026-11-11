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
