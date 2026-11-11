-- =====================================================================
-- Afiliados de Deriv automáticos. Correr DESPUÉS de retos.sql. Se puede correr varias veces.
--  - El admin pega la lista de IDs de sus clientes de Deriv Partners.
--  - Las solicitudes pendientes (o rechazadas) cuyo ID está en la lista se aprueban solas.
--  - Las solicitudes nuevas con un ID de la lista se aprueban al instante.
-- =====================================================================

create table if not exists public.partner_clients (
  deriv_id text primary key,
  added_at timestamptz not null default now()
);
alter table public.partner_clients enable row level security;
drop policy if exists "socios: admin" on public.partner_clients;
create policy "socios: admin" on public.partner_clients for all using (public.is_admin()) with check (public.is_admin());

-- cargar la lista y aprobar a los que coinciden
create or replace function public.admin_partner_import(p_ids text[], p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_add int := 0; n_ok int := 0; ids text[];
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select coalesce(array_agg(distinct x), '{}') into ids
    from (select upper(regexp_replace(coalesce(v,''), '\s', '', 'g')) x from unnest(coalesce(p_ids, '{}')) v) t
    where x ~ '^[A-Z]{1,5}[0-9]{3,12}$' or x ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' or x ~ '^D-[A-Z0-9]{5,10}$';  -- CR1234567 o el ID largo de Deriv Partners
  if p_replace then delete from public.partner_clients; end if;
  insert into public.partner_clients (deriv_id) select unnest(ids) on conflict do nothing;
  get diagnostics n_add = row_count;
  with ok as (
    update public.affiliates a set status = 'verificado', reviewed_at = now(), admin_note = 'Verificado automáticamente con la lista de socios'
    where a.status in ('pendiente','rechazado') and exists (select 1 from public.partner_clients c where c.deriv_id = upper(a.deriv_id))
    returning a.user_id)
  update public.profiles p set affiliate = true from ok where p.id = ok.user_id;
  get diagnostics n_ok = row_count;
  return jsonb_build_object('received', coalesce(array_length(ids,1),0), 'added', n_add, 'approved', n_ok,
    'total', (select count(*) from public.partner_clients));
end $$;
grant execute on function public.admin_partner_import(text[], boolean) to authenticated;

create or replace function public.admin_partner_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return jsonb_build_object('total', (select count(*) from public.partner_clients), 'updated', (select max(added_at) from public.partner_clients));
end $$;
grant execute on function public.admin_partner_info() to authenticated;

-- solicitud del alumno: si el ID ya está en la lista, queda verificado al instante
create or replace function public.request_affiliate(p_deriv text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur public.affiliates; d text := upper(regexp_replace(coalesce(p_deriv,''), '\s', '', 'g')); inlist boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if char_length(d) < 3 or char_length(d) > 40 then raise exception 'Escribe tu ID de cliente de Deriv (ej.: CR1234567)'; end if;
  if exists (select 1 from public.affiliates where upper(deriv_id) = d and user_id <> auth.uid() and status <> 'rechazado') then
    raise exception 'Ese ID de Deriv ya está registrado por otra cuenta'; end if;
  select * into cur from public.affiliates where user_id = auth.uid();
  if found and cur.status = 'verificado' then raise exception 'Ya eres afiliado verificado'; end if;
  inlist := exists (select 1 from public.partner_clients where deriv_id = d);
  insert into public.affiliates (user_id, deriv_id, status, admin_note, created_at, reviewed_at)
  values (auth.uid(), d, case when inlist then 'verificado' else 'pendiente' end,
          case when inlist then 'Verificado automáticamente con la lista de socios' else '' end, now(), case when inlist then now() end)
  on conflict (user_id) do update set deriv_id = excluded.deriv_id, status = excluded.status, admin_note = excluded.admin_note,
    created_at = now(), reviewed_at = excluded.reviewed_at;
  if inlist then update public.profiles set affiliate = true where id = auth.uid(); end if;
  return jsonb_build_object('status', case when inlist then 'verificado' else 'pendiente' end);
end $$;
grant execute on function public.request_affiliate(text) to authenticated;
