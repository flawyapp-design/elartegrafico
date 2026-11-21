-- Campana de notificaciones de la web: todo lo que se envía como notificación queda guardado aquí (30 días)
-- La función send-push guarda cada envío (una fila por envío, no por persona).

create table if not exists public.notifs (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  title      text not null,
  body       text not null default '',
  url        text not null default '',
  tag        text not null default '',
  aud        text not null default 'todos',      -- todos / premium / gratis / oro
  user_id    uuid references public.profiles(id) on delete cascade,   -- personal (solo esa persona)
  admins     boolean not null default false        -- solo para administradores
);
create index if not exists notifs_fecha on public.notifs(created_at desc);
create index if not exists notifs_user on public.notifs(user_id, created_at desc);
alter table public.notifs enable row level security;
-- sin políticas: se lee con my_notifs() y se escribe desde send-push (service role)

-- mis notificaciones: las generales que me tocan según mi plan + las personales
create or replace function public.my_notifs(p_limit int default 40)
returns table(id bigint, created_at timestamptz, title text, body text, url text, tag text, personal boolean)
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); adm boolean := public.is_admin(); prem boolean := false; pl text := '';
begin
  if u is not null then
    select coalesce(p.premium_until > now(), false), coalesce(p.plan, '') into prem, pl from public.profiles p where p.id = u;
  end if;
  return query
    select n.id, n.created_at, n.title, n.body, n.url, n.tag, n.user_id is not null
    from public.notifs n
    where n.created_at > now() - interval '30 days'
      and (
        (n.user_id is not null and n.user_id = u)
        or (n.admins and adm)
        or (n.user_id is null and not n.admins and (
              adm or n.aud = 'todos'
              or (n.aud = 'premium' and prem)
              or (n.aud = 'gratis' and not prem)
              or (n.aud = 'oro' and prem and pl in ('oro','diamond'))))
      )
    order by n.created_at desc
    limit least(greatest(coalesce(p_limit, 40), 1), 100);
end $$;
grant execute on function public.my_notifs(int) to anon, authenticated;

-- limpieza: más de 30 días
create or replace function public.notifs_cleanup() returns void language sql security definer set search_path = public as $$
  delete from public.notifs where created_at < now() - interval '30 days';
$$;
revoke execute on function public.notifs_cleanup() from public, anon, authenticated;

select 'listo' as estado;
