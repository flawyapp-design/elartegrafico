-- EAG Charts en vivo: quién está usando los charts ahora mismo (para el panel de administración)
-- Cada página abierta de EAG Charts avisa cada ~45 segundos (chart_ping). Se considera "en línea" si avisó en los últimos 2 minutos.

create table if not exists public.chart_presence (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),   -- desde cuándo está conectado (esta sesión)
  last_seen   timestamptz not null default now(),
  symbol      text,
  symbol_name text,
  tf          text,
  layout      text,
  device      text,
  profile     text,
  panes       int
);
alter table public.chart_presence enable row level security;
-- sin políticas: solo se toca por las funciones de abajo
create index if not exists chart_presence_seen on public.chart_presence(last_seen desc);

-- el alumno avisa que está usando los charts
create or replace function public.chart_ping(p_symbol text default null, p_name text default null, p_tf text default null,
  p_layout text default null, p_device text default null, p_profile text default null, p_panes int default null)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then return; end if;
  insert into public.chart_presence as c (user_id, started_at, last_seen, symbol, symbol_name, tf, layout, device, profile, panes)
  values (u, now(), now(), left(p_symbol,40), left(p_name,60), left(p_tf,10), left(p_layout,10), left(p_device,20), left(p_profile,30), p_panes)
  on conflict (user_id) do update set
    -- si llevaba más de 3 minutos sin avisar, es una sesión nueva
    started_at  = case when c.last_seen < now() - interval '3 minutes' then now() else c.started_at end,
    last_seen   = now(),
    symbol      = coalesce(excluded.symbol, c.symbol),
    symbol_name = coalesce(excluded.symbol_name, c.symbol_name),
    tf          = coalesce(excluded.tf, c.tf),
    layout      = coalesce(excluded.layout, c.layout),
    device      = coalesce(excluded.device, c.device),
    profile     = coalesce(excluded.profile, c.profile),
    panes       = coalesce(excluded.panes, c.panes);
end $$;
grant execute on function public.chart_ping(text,text,text,text,text,text,int) to authenticated;

-- al cerrar la página
create or replace function public.chart_bye() returns void language plpgsql security definer set search_path = public as $$
begin
  update public.chart_presence set last_seen = now() - interval '5 minutes' where user_id = auth.uid();
end $$;
grant execute on function public.chart_bye() to authenticated;

-- panel de admin: los conectados ahora y los que entraron hoy
drop function if exists public.admin_chart_online();
create function public.admin_chart_online()
returns table(user_id uuid, username text, avatar_url text, country text, plan text, premium boolean, affiliate boolean, role text,
  online boolean, started_at timestamptz, last_seen timestamptz, symbol text, symbol_name text, tf text, layout text, device text, profile text, panes int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query
    select c.user_id, p.username, p.avatar_url, p.country, p.plan, coalesce(p.premium_until > now(), false), coalesce(p.affiliate, false), p.role,
      c.last_seen > now() - interval '2 minutes', c.started_at, c.last_seen, c.symbol, c.symbol_name, c.tf, c.layout, c.device, c.profile, c.panes
    from public.chart_presence c join public.profiles p on p.id = c.user_id
    where c.last_seen > now() - interval '24 hours'
    order by (c.last_seen > now() - interval '2 minutes') desc, c.last_seen desc
    limit 500;
end $$;
grant execute on function public.admin_chart_online() to authenticated;

select 'listo' as estado;
