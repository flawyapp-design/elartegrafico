-- EAG Charts · Grupo general: quién leyó cada mensaje ("Visto por …")
-- Devuelve hasta dónde leyó cada persona del grupo (solo los que leyeron desde p_min en adelante).
create or replace function public.chat_group_reads(p_min bigint default 0)
returns table(user_id uuid, username text, avatar_url text, last_id bigint)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.username, p.avatar_url, r.last_id
  from public.chart_reads r join public.profiles p on p.id = r.user_id
  where auth.uid() is not null and r.room = 'g:general' and r.last_id >= coalesce(p_min, 0)
  order by r.last_id desc
  limit 500
$$;
revoke execute on function public.chat_group_reads(bigint) from public, anon;
grant execute on function public.chat_group_reads(bigint) to authenticated;
