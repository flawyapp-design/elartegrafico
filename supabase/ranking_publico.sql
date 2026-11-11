-- ---------- RANKING PÚBLICO + PLACA PREMIUM + PAÍS EN ALUMNOS ----------
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.
-- 1) El ranking lo puede ver cualquiera (también sin cuenta) y dice quién es premium.
drop function if exists public.leaderboard();
create function public.leaderboard() returns table(username text, xp int, lessons int, is_me boolean, avatar_url text, country text, premium boolean)
language sql stable security definer set search_path = public as $$
  select p.username, g.xp,
         coalesce((select count(*) from jsonb_each(g.data->'done') d where (d.value->>'passed')::boolean),0)::int,
         coalesce(g.user_id = auth.uid(), false), p.avatar_url, p.country,
         coalesce(p.premium_until > now(), false)
  from public.progress g join public.profiles p on p.id = g.user_id
  where not p.banned and p.role <> 'admin' and g.xp > 0
  order by g.xp desc limit 100
$$;
grant execute on function public.leaderboard() to anon, authenticated;

-- 2) Lista de alumnos del admin con el país
drop function if exists public.admin_users();
create function public.admin_users() returns table(id uuid, username text, email text, role text, premium_until timestamptz, demo_used int, banned boolean, created_at timestamptz, xp int, avatar_url text, country text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select p.id, p.username, u.email::text, p.role, p.premium_until, p.demo_used, p.banned, p.created_at, coalesce(g.xp,0), p.avatar_url, p.country
    from public.profiles p join auth.users u on u.id = p.id left join public.progress g on g.user_id = p.id order by p.created_at desc;
end $$;
grant execute on function public.admin_users() to authenticated;
