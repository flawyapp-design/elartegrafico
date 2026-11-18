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
