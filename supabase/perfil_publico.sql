-- =====================================================================
-- Perfil público: al tocar un nombre en el ranking, los retos o la comunidad se abre su tarjeta.
-- Correr DESPUÉS de chat.sql. Se puede correr varias veces.
-- Muestra solo lo que ya es público: foto, país, placa, afiliado, nivel, avance y retos.
-- Nunca muestra correo, ID de Deriv, cuenta de Binance ni pagos.
-- =====================================================================

drop function if exists public.public_profile(text);
create function public.public_profile(p_username text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; g public.progress; m timestamptz := date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
  total int; passed int; mpts int; pos int;
begin
  select * into p from public.profiles where lower(username) = lower(trim(coalesce(p_username, ''))) limit 1;
  if not found or p.banned then return null; end if;
  select * into g from public.progress where user_id = p.id;
  select count(*) into total from public.lessons l join public.modules md on md.id = l.module_id where l.status = 'publicado' and md.status = 'publicado';
  select count(*) into passed from jsonb_each(coalesce(g.data->'done', '{}'::jsonb)) d
    where (d.value->>'passed')::boolean and exists (select 1 from public.lessons l where l.id::text = d.key and l.status = 'publicado');
  -- puntos del mes y puesto en el ranking del mes
  with pts as (select user_id, points, created_at from public.revealed_entries() where points > 0
               union all select user_id, points, created_at from public.reward_bonuses where points > 0),
       tot as (select x.user_id, sum(x.points)::int s from pts x join public.profiles q on q.id = x.user_id
               where x.created_at >= m and not q.banned and q.role <> 'admin' group by x.user_id)
  select coalesce((select s from tot where user_id = p.id), 0), (select 1 + count(*) from tot where s > coalesce((select s from tot where user_id = p.id), 0))
    into mpts, pos;
  return jsonb_build_object(
    'username', p.username, 'avatar_url', p.avatar_url, 'country', p.country, 'since', p.created_at,
    'is_admin', p.role = 'admin', 'is_me', coalesce(p.id = auth.uid(), false),
    'premium', coalesce(p.premium_until > now(), false),
    'plan', case when coalesce(p.premium_until > now(), false) then nullif(p.plan, '') end,
    'affiliate', coalesce(p.affiliate, false),
    'xp', coalesce(g.xp, 0), 'lessons', passed, 'lessons_total', total,
    'courses', coalesce((select jsonb_agg(jsonb_build_object('title', c.title, 'icon', c.icon, 'color', c.color,
        'graduated', (select count(*) from public.lessons l join public.modules md on md.id = l.module_id
                        where md.course_id = c.id and l.status = 'publicado') > 0
                     and not exists (select 1 from public.lessons l join public.modules md on md.id = l.module_id
                        where md.course_id = c.id and l.status = 'publicado'
                          and not coalesce((g.data->'done'->(l.id::text)->>'passed')::boolean, false)))
        order by c.sort)
      from public.user_courses uc join public.courses c on c.id = uc.course_id where uc.user_id = p.id), '[]'::jsonb),
    'month_points', mpts, 'month_pos', case when mpts > 0 then pos end,
    'points', coalesce((select sum(points) from public.revealed_entries() where user_id = p.id), 0)
              + coalesce((select sum(points) from public.reward_bonuses where user_id = p.id), 0),
    'wins', (select count(*) from public.revealed_entries() where user_id = p.id and place is not null),
    'firsts', (select count(*) from public.revealed_entries() where user_id = p.id and place = 1),
    'played', (select count(*) from public.challenge_entries where user_id = p.id),
    'streak', public.challenge_streak(p.id), 'best_streak', public.challenge_best_streak(p.id));
end $$;
grant execute on function public.public_profile(text) to anon, authenticated;
