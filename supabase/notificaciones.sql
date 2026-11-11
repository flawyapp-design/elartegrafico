-- Notificaciones push (app instalable). Correr una vez en SQL Editor.
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  ua text not null default '',
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "suscripcion propia" on public.push_subs;
create policy "suscripcion propia" on public.push_subs for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "borrar suscripcion propia" on public.push_subs;
create policy "borrar suscripcion propia" on public.push_subs for delete using (user_id = auth.uid());

create or replace function public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text, p_ua text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Suscripción no válida'; end if;
  insert into public.push_subs(endpoint, user_id, p256dh, auth, ua) values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_ua,''), 200))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua;
end $$;
grant execute on function public.save_push_sub(text, text, text, text) to authenticated;

-- llaves VAPID: las genera la función send-push la primera vez. Nadie las lee desde la web (sin políticas).
create table if not exists public.push_config (id int primary key default 1 check (id = 1), public_key text not null, private_key text not null);
alter table public.push_config enable row level security;
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$ select public_key from public.push_config where id = 1 $$;
grant execute on function public.push_public_key() to anon, authenticated;

create or replace function public.admin_push_stats() returns table(total int, premium int, gratis int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select count(distinct s.user_id)::int,
    count(distinct s.user_id) filter (where p.premium_until > now())::int,
    count(distinct s.user_id) filter (where p.premium_until is null or p.premium_until <= now())::int
  from public.push_subs s join public.profiles p on p.id = s.user_id where not p.banned;
end $$;
grant execute on function public.admin_push_stats() to authenticated;
