-- Bloquear / desbloquear módulos a mano o con fecha de apertura.
alter table public.modules add column if not exists available boolean not null default false;
alter table public.modules add column if not exists open_at timestamptz;
update public.modules set available = true where status = 'publicado' and open_at is null and available = false and title ilike 'Demo%';

create or replace function public.module_open(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.available or (m.open_at is not null and m.open_at <= now()) from public.modules m where m.id = mid), false)
$$;
grant execute on function public.module_open(uuid) to anon, authenticated;

-- las lecciones de un módulo bloqueado no se pueden leer (salvo el administrador)
drop policy if exists "leer lecciones" on public.lessons;
create policy "leer lecciones" on public.lessons for select
  using (public.is_admin() or (public.is_premium() and status = 'publicado' and public.module_open(module_id)));
