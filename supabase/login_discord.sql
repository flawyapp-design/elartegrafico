-- =====================================================================
-- Ingresar / crear cuenta con Discord
-- Quien entra con Discord queda con: nombre de usuario sacado de Discord,
-- su foto de Discord y su Discord ya conectado (para el rol de Miembro verificado).
-- Necesita discord_afiliados.sql corrido antes. Se puede correr varias veces.
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text; m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  prov text := coalesce(new.raw_app_meta_data->>'provider', ''); did text; dname text; av text;
begin
  u := nullif(m->>'username', '');
  if prov = 'discord' then
    did := nullif(m->>'provider_id', '');
    dname := coalesce(nullif(m->'custom_claims'->>'global_name', ''), nullif(m->>'full_name', ''), nullif(m->>'name', ''));
    av := nullif(m->>'avatar_url', '');
    if u is null then u := coalesce(nullif(m->>'full_name', ''), nullif(m->>'name', ''), dname); end if;
    -- una cuenta de Discord solo puede estar conectada a un perfil
    if did is not null and exists (select 1 from public.profiles where discord_id = did) then did := null; end if;
  end if;
  -- el nombre de usuario solo acepta letras, números, punto y guion bajo (3 a 24)
  u := left(regexp_replace(coalesce(u, ''), '[^A-Za-z0-9_.]', '', 'g'), 20);
  if char_length(u) < 3 then u := 'alumno_' || substr(new.id::text, 1, 8); end if;
  if exists (select 1 from public.profiles where lower(username) = lower(u)) then
    u := left(u, 19) || '_' || substr(new.id::text, 1, 4);
  end if;
  insert into public.profiles(id, username, avatar_url, discord_id, discord_name)
  values (new.id, u, av, did, case when did is not null then dname end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- =====================================================================
-- Arreglo: quien entra con Discord no podía guardar su país/perfil
-- (la foto de Discord se rechazaba como "Foto no válida").
-- Ahora se acepta: una foto subida a la página, la misma foto que ya tenía,
-- o su foto de Discord. Corre este archivo en Supabase → SQL Editor.
-- =====================================================================
create or replace function public.update_my_profile(p_avatar text, p_bio text, p_country text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare cur text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select avatar_url into cur from public.profiles where id = auth.uid();
  if p_avatar is not null and p_avatar <> ''
     and p_avatar is distinct from cur
     and p_avatar not like '%/storage/v1/object/public/avatars/' || auth.uid()::text || '/%'
     and p_avatar !~ '^https://cdn\.discordapp\.com/(avatars|embed/avatars)/[0-9A-Za-z/_.-]+$' then
    raise exception 'Foto no válida';
  end if;
  update public.profiles set avatar_url = nullif(p_avatar, ''), bio = left(coalesce(p_bio, ''), 160), country = left(coalesce(p_country, ''), 40)
   where id = auth.uid();
end $$;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
