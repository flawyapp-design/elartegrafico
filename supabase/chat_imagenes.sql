-- Imágenes en el chat de soporte (Mensajes): se guardan comprimidas en el almacenamiento de archivos (no en la base de datos)
-- y se borran solas junto con los mensajes viejos o al finalizar la conversación.

-- carpeta "chat": cada quien sube en su carpeta, máximo 2 MB, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "chat fotos lectura" on storage.objects;
create policy "chat fotos lectura" on storage.objects for select using (bucket_id = 'chat');
drop policy if exists "chat fotos sube" on storage.objects;
create policy "chat fotos sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "chat fotos borra" on storage.objects;
create policy "chat fotos borra" on storage.objects for delete using (bucket_id = 'chat' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- enviar mensaje (igual que antes) + revisión de las fotos
create or replace function public.dm_send(p_body text, p_user uuid default null, p_topic text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.is_admin(); u uuid; b text := trim(coalesce(p_body, '')); t public.dm_threads; m public.dm_messages;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if b = '' then raise exception 'Escribe un mensaje'; end if;
  if char_length(b) > 1500 then raise exception 'El mensaje es muy largo (máximo 1500 letras)'; end if;
  -- fotos: solo de nuestra carpeta de imágenes del chat, y cada alumno solo las suyas
  if not adm and b like '%/storage/v1/object/public/chat/%' and b not like '%/storage/v1/object/public/chat/' || auth.uid()::text || '/%' then
    raise exception 'Imagen no válida'; end if;
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

-- fotos para borrar: las más viejas que los días del chat, o todas las de una conversación
create or replace function public.chat_img_old(p_user uuid default null) returns setof text
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if p_user is not null then
    return query select o.name from storage.objects o where o.bucket_id = 'chat' and o.name like p_user::text || '/%';
  else
    return query select o.name from storage.objects o where o.bucket_id = 'chat' and o.created_at < now() - make_interval(days => public.dm_days()) limit 1000;
  end if;
end $$;
grant execute on function public.chat_img_old(uuid) to authenticated;

select 'listo' as estado;
