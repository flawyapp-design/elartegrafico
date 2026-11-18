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
