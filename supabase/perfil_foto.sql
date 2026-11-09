-- Foto de perfil, descripción corta y país. Cada usuario edita solo lo suyo.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists country text not null default '';

create or replace function public.update_my_profile(p_avatar text, p_bio text, p_country text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_avatar is not null and p_avatar <> '' and p_avatar not like '%/storage/v1/object/public/avatars/' || auth.uid()::text || '/%' then
    raise exception 'Foto no válida';
  end if;
  update public.profiles set avatar_url = nullif(p_avatar, ''), bio = left(coalesce(p_bio, ''), 160), country = left(coalesce(p_country, ''), 40)
   where id = auth.uid();
end $$;
grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- carpeta de fotos: cada quien sube solo dentro de su carpeta (su id), máximo 2 MB, solo imágenes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "avatars lectura" on storage.objects;
create policy "avatars lectura" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars sube propio" on storage.objects;
create policy "avatars sube propio" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars cambia propio" on storage.objects;
create policy "avatars cambia propio" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars borra propio" on storage.objects;
create policy "avatars borra propio" on storage.objects for delete using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- mostrar la foto en ranking, comentarios, opiniones y lista de alumnos
drop function if exists public.leaderboard();
create function public.leaderboard() returns table(username text, xp int, lessons int, is_me boolean, avatar_url text, country text)
language sql stable security definer set search_path = public as $$
  select p.username, g.xp, coalesce((select count(*) from jsonb_each(g.data->'done') d where (d.value->>'passed')::boolean),0)::int, g.user_id = auth.uid(), p.avatar_url, p.country
  from public.progress g join public.profiles p on p.id = g.user_id
  where not p.banned order by g.xp desc limit 50
$$;
grant execute on function public.leaderboard() to authenticated;

drop function if exists public.post_comments(uuid);
create function public.post_comments(pid uuid) returns table(id uuid, body text, created_at timestamptz, username text, mine boolean, is_admin boolean, avatar_url text)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, p.username, c.user_id = auth.uid(), p.role = 'admin', p.avatar_url
  from public.comments c join public.profiles p on p.id = c.user_id
  where c.post_id = pid and auth.uid() is not null order by c.created_at
$$;
grant execute on function public.post_comments(uuid) to authenticated;

drop function if exists public.public_reviews();
create function public.public_reviews() returns table(id uuid, rating int, body text, created_at timestamptz, username text, premium boolean, avatar_url text)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.body, r.created_at, p.username, (p.premium_until > now()), p.avatar_url
  from public.reviews r join public.profiles p on p.id = r.user_id
  where r.approved and not p.banned order by r.created_at desc limit 60
$$;
grant execute on function public.public_reviews() to anon, authenticated;

drop function if exists public.admin_users();
create function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int, avatar_url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.id, p.username, u.email::text, p.role, p.premium_until, p.demo_used, p.banned, p.created_at, coalesce(g.xp,0), p.avatar_url
    from public.profiles p join auth.users u on u.id = p.id left join public.progress g on g.user_id = p.id order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;
