-- Quién está en línea (para la bolita verde en Admin → Mensajes)
-- El sitio y la academia avisan cada ~60 s (site_ping). EAG Charts ya avisa con chart_ping (chart_presence).
-- "En línea" = avisó en los últimos 2 minutos. Requiere haber corrido charts_en_vivo.sql antes.

create table if not exists public.site_presence (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  last_seen timestamptz not null default now(),
  place     text,
  device    text
);
alter table public.site_presence enable row level security;
-- sin políticas: solo se toca con las funciones de abajo
create index if not exists site_presence_seen on public.site_presence(last_seen desc);

create or replace function public.site_ping(p_place text default null, p_device text default null)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then return; end if;
  insert into public.site_presence as s (user_id, last_seen, place, device)
  values (u, now(), left(p_place, 40), left(p_device, 20))
  on conflict (user_id) do update set last_seen = now(), place = left(p_place, 40), device = left(p_device, 20);
end $$;
revoke execute on function public.site_ping(text, text) from public, anon;
grant execute on function public.site_ping(text, text) to authenticated;

-- admin: dónde se vio a cada persona en la última hora (lo más reciente entre sitio/academia y charts)
create or replace function public.admin_online_users()
returns table(user_id uuid, last_seen timestamptz, place text, device text, online boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Solo admin'; end if;
  return query
  select distinct on (x.user_id) x.user_id, x.last_seen, x.place, x.device, (x.last_seen > now() - interval '2 minutes') as online
  from (
    select s.user_id, s.last_seen, s.place, s.device from public.site_presence s where s.last_seen > now() - interval '1 hour'
    union all
    select c.user_id, c.last_seen, 'Charts' || coalesce(' · ' || nullif(c.symbol_name, ''), ''), c.device from public.chart_presence c where c.last_seen > now() - interval '1 hour'
  ) x
  order by x.user_id, x.last_seen desc;
end $$;
revoke execute on function public.admin_online_users() from public, anon;
grant execute on function public.admin_online_users() to authenticated;
