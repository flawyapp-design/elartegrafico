-- =====================================================================
-- Afiliados de Deriv automáticos. Correr DESPUÉS de retos.sql. Se puede correr varias veces.
--  - Lista ACTIVA (clientes que operaron este mes): quien envíe un ID de ahí queda verificado solo.
--  - Lista ANTIGUA (meses anteriores): no se aprueba sola; el admin ve "Está en tu lista antigua"
--    y lo autoriza con un clic.
--  - Cada mes el admin pega la lista nueva marcando "lista nueva del mes": los activos que ya
--    no aparecen pasan solos a la lista antigua.
--  - Acepta IDs largos (019c0ed8-…), cortos (d-k3skg7d) y tipo CR1234567.
-- =====================================================================

create table if not exists public.partner_clients (
  deriv_id text primary key,
  added_at timestamptz not null default now()
);
alter table public.partner_clients add column if not exists tier text not null default 'activo';
alter table public.partner_clients add column if not exists seen_at timestamptz not null default now();
alter table public.partner_clients drop constraint if exists partner_clients_tier_chk;
alter table public.partner_clients add constraint partner_clients_tier_chk check (tier in ('activo','antiguo'));
alter table public.partner_clients enable row level security;
drop policy if exists "socios: admin" on public.partner_clients;
create policy "socios: admin" on public.partner_clients for all using (public.is_admin()) with check (public.is_admin());

-- limpiar y validar los IDs pegados
create or replace function public.partner_clean(p_ids text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}')
  from (select upper(regexp_replace(coalesce(v,''), '\s', '', 'g')) x from unnest(coalesce(p_ids, '{}')) v) t
  where x ~ '^[A-Z]{1,5}[0-9]{3,12}$' or x ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' or x ~ '^D-[A-Z0-9]{5,10}$'
$$;

-- cargar una lista. p_tier: 'activo' (se aprueban solos) o 'antiguo' (solo avisa).
-- p_monthly: es la lista nueva del mes -> los activos que no vienen en ella pasan a 'antiguo'.
drop function if exists public.admin_partner_import(text[], boolean);
drop function if exists public.admin_partner_import(text[], boolean, text);
create function public.admin_partner_import(p_ids text[], p_monthly boolean default false, p_tier text default 'activo') returns jsonb
language plpgsql security definer set search_path = public as $$
declare ids text[] := public.partner_clean(p_ids); n_new int := 0; n_old int := 0; n_ok int := 0; t text := case when p_tier = 'antiguo' then 'antiguo' else 'activo' end;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  if t = 'activo' and p_monthly then
    update public.partner_clients set tier = 'antiguo' where tier = 'activo' and not (deriv_id = any(ids));
    get diagnostics n_old = row_count;
  end if;
  if t = 'activo' then
    insert into public.partner_clients (deriv_id, tier, seen_at) select unnest(ids), 'activo', now()
    on conflict (deriv_id) do update set tier = 'activo', seen_at = now();
  else
    insert into public.partner_clients (deriv_id, tier, seen_at) select unnest(ids), 'antiguo', now()
    on conflict (deriv_id) do nothing;   -- nunca baja a un activo
  end if;
  get diagnostics n_new = row_count;
  with ok as (
    update public.affiliates a set status = 'verificado', reviewed_at = now(), admin_note = 'Verificado automáticamente con la lista de socios activos'
    where a.status in ('pendiente','rechazado') and exists (select 1 from public.partner_clients c where c.deriv_id = upper(a.deriv_id) and c.tier = 'activo')
    returning a.user_id)
  update public.profiles p set affiliate = true from ok where p.id = ok.user_id;
  get diagnostics n_ok = row_count;
  return jsonb_build_object('received', coalesce(array_length(ids,1),0), 'saved', n_new, 'moved_old', n_old, 'approved', n_ok,
    'active', (select count(*) from public.partner_clients where tier = 'activo'),
    'old', (select count(*) from public.partner_clients where tier = 'antiguo'));
end $$;
grant execute on function public.admin_partner_import(text[], boolean, text) to authenticated;

create or replace function public.admin_partner_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return jsonb_build_object('total', (select count(*) from public.partner_clients),
    'active', (select count(*) from public.partner_clients where tier = 'activo'),
    'old', (select count(*) from public.partner_clients where tier = 'antiguo'),
    'updated', (select max(seen_at) from public.partner_clients where tier = 'activo'));
end $$;
grant execute on function public.admin_partner_info() to authenticated;

-- solicitudes para admin, con la marca de en qué lista está el ID
drop function if exists public.admin_affiliates();
create function public.admin_affiliates() returns table(user_id uuid, username text, email text, country text, deriv_id text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz, in_list text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select a.user_id, p.username, u.email::text, p.country, a.deriv_id, a.status, a.admin_note, a.created_at, a.reviewed_at,
      (select c.tier from public.partner_clients c where c.deriv_id = upper(a.deriv_id))
    from public.affiliates a join public.profiles p on p.id = a.user_id join auth.users u on u.id = a.user_id
    order by (a.status = 'pendiente') desc, a.created_at desc limit 500;
end $$;
grant execute on function public.admin_affiliates() to authenticated;

-- aprobar de una vez a todos los pendientes que están en la lista antigua
create or replace function public.admin_partner_approve_old() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  with ok as (
    update public.affiliates a set status = 'verificado', reviewed_at = now(), admin_note = 'Autorizado por el admin (lista antigua de socios)'
    where a.status = 'pendiente' and exists (select 1 from public.partner_clients c where c.deriv_id = upper(a.deriv_id) and c.tier = 'antiguo')
    returning a.user_id)
  update public.profiles p set affiliate = true from ok where p.id = ok.user_id;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.admin_partner_approve_old() to authenticated;

-- solicitud del alumno: si el ID está en la lista ACTIVA, queda verificado al instante
create or replace function public.request_affiliate(p_deriv text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.affiliates; d text := upper(regexp_replace(coalesce(p_deriv,''), '\s', '', 'g')); act boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(d) < 3 or char_length(d) > 40 then raise exception 'Escribe tu ID de cliente de Deriv'; end if;
  if exists (select 1 from public.affiliates where upper(deriv_id) = d and user_id <> auth.uid() and status <> 'rechazado') then
    raise exception 'Ese ID de Deriv ya está registrado por otra cuenta'; end if;
  select * into cur from public.affiliates where user_id = auth.uid();
  if found and cur.status = 'verificado' then raise exception 'Ya eres afiliado verificado'; end if;
  act := exists (select 1 from public.partner_clients where deriv_id = d and tier = 'activo');
  insert into public.affiliates (user_id, deriv_id, status, admin_note, created_at, reviewed_at)
  values (auth.uid(), d, case when act then 'verificado' else 'pendiente' end,
          case when act then 'Verificado automáticamente con la lista de socios activos' else '' end, now(), case when act then now() end)
  on conflict (user_id) do update set deriv_id = excluded.deriv_id, status = excluded.status, admin_note = excluded.admin_note,
    created_at = now(), reviewed_at = excluded.reviewed_at;
  if act then update public.profiles set affiliate = true where id = auth.uid(); end if;
  return jsonb_build_object('status', case when act then 'verificado' else 'pendiente' end);
end $$;
grant execute on function public.request_affiliate(text) to authenticated;
