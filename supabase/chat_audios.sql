-- Notas de voz en el chat de EAG Charts.
-- Se puede correr varias veces sin dañar nada.

-- 1) el bucket del chat acepta también audio (máx. 3 MB por archivo)
update storage.buckets
   set file_size_limit = 3145728,
       allowed_mime_types = array['image/jpeg','image/png','image/webp',
                                  'audio/webm','audio/mp4','audio/aac','audio/mpeg','audio/ogg','audio/x-m4a']
 where id = 'chartchat';

-- 2) nuevo tipo de mensaje: 'audio'
alter table public.chart_msgs drop constraint if exists chart_msgs_kind_check;
alter table public.chart_msgs add constraint chart_msgs_kind_check check (kind in ('text','share','call','img','idea','audio'));

-- 3) enviar (igual que antes + audio)
create or replace function public.chat_send(p_room text, p_body text, p_kind text default 'text', p_payload jsonb default null)
returns public.chart_msgs language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); r public.chart_msgs; other uuid; n int;
begin
  if u is null then raise exception 'Ingresa con tu cuenta.'; end if;
  if not public.chat_can() then raise exception 'Tu chat está desactivado.'; end if;
  if p_kind not in ('text','share','call','img','idea','audio') then raise exception 'Tipo inválido.'; end if;
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
  -- fotos y audios solo pueden venir de tu carpeta del chat de los charts
  if p_kind in ('img','audio') and coalesce(p_payload->>'url','') not like '%/storage/v1/object/public/chartchat/' || u::text || '/%' then raise exception 'Archivo no válido.'; end if;
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
