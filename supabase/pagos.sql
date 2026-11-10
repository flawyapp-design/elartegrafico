-- ---------- PAGOS POR BINANCE (semiautomático) ----------
-- El alumno registra su pago (ID de orden de Binance Pay); el admin lo revisa en su Binance y lo aprueba con un clic.
-- Aprobar suma los días al premium del alumno (desde hoy o desde su vencimiento, lo que sea mayor).
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces.

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  method text not null default 'binance' check (method in ('binance','otro')),
  plan text not null default '' check (char_length(plan) <= 80),
  days int not null default 30 check (days between 1 and 3650),
  amount text not null default '' check (char_length(amount) <= 40),
  order_id text not null check (char_length(order_id) between 4 and 80),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pendiente' check (status in ('pendiente','aprobado','rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
-- un mismo ID de orden no se puede usar dos veces (salvo que se haya rechazado)
create unique index if not exists payment_requests_order_uq
  on public.payment_requests (method, lower(order_id)) where status <> 'rechazado';
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at desc);
alter table public.payment_requests enable row level security;

drop policy if exists "pagos: ver los propios" on public.payment_requests;
create policy "pagos: ver los propios" on public.payment_requests for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "pagos: registrar el propio" on public.payment_requests;
create policy "pagos: registrar el propio" on public.payment_requests for insert
  with check (user_id = auth.uid() and status = 'pendiente' and admin_note = '' and reviewed_at is null);
drop policy if exists "pagos: admin" on public.payment_requests;
create policy "pagos: admin" on public.payment_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- máximo 3 pagos pendientes por alumno (evita spam)
create or replace function public.payment_requests_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.payment_requests where user_id = new.user_id and status = 'pendiente') >= 3 then
    raise exception 'Ya tienes 3 pagos por confirmar. Espera a que los revisemos.';
  end if;
  return new;
end $$;
drop trigger if exists payment_requests_limit on public.payment_requests;
create trigger payment_requests_limit before insert on public.payment_requests
  for each row execute function public.payment_requests_limit();

-- lista para el admin (con usuario y correo)
drop function if exists public.admin_payments();
create function public.admin_payments() returns table(id uuid, user_id uuid, username text, email text, premium_until timestamptz,
  method text, plan text, days int, amount text, order_id text, note text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  return query select r.id, r.user_id, p.username, u.email::text, p.premium_until, r.method, r.plan, r.days, r.amount, r.order_id,
    r.note, r.status, r.admin_note, r.created_at, r.reviewed_at
  from public.payment_requests r join public.profiles p on p.id = r.user_id join auth.users u on u.id = r.user_id
  order by (r.status = 'pendiente') desc, r.created_at desc limit 300;
end $$;
grant execute on function public.admin_payments() to authenticated;

-- aprobar o rechazar (todo en un paso)
drop function if exists public.review_payment(uuid, boolean, int, text);
create function public.review_payment(pid uuid, approve boolean, p_days int default null, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.payment_requests; d int; hasta timestamptz;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select * into r from public.payment_requests where id = pid for update;
  if not found then raise exception 'El pago no existe'; end if;
  if r.status <> 'pendiente' then raise exception 'Este pago ya fue revisado'; end if;
  if approve then
    d := coalesce(p_days, r.days);
    if d < 1 or d > 3650 then raise exception 'Días no válidos'; end if;
    update public.profiles
       set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => d)
     where id = r.user_id returning premium_until into hasta;
    update public.payment_requests set status = 'aprobado', days = d, admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
  else
    update public.payment_requests set status = 'rechazado', admin_note = coalesce(p_note, ''), reviewed_at = now() where id = pid;
  end if;
  return jsonb_build_object('status', case when approve then 'aprobado' else 'rechazado' end, 'premium_until', hasta);
end $$;
grant execute on function public.review_payment(uuid, boolean, int, text) to authenticated;
