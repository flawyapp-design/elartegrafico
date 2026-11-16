-- =====================================================================
-- EAG Charts: Modo Clase (en vivo) y Zonas del profe.
--  · live_class: lo que el profe está dibujando ahora (una sola fila). La ven todos los registrados.
--  · teacher_zones: el análisis publicado por mercado. Lo ven Oro, Diamond, el admin y quienes estén
--    en la prueba de 3 días con el Estudio incluido.
-- Solo el admin escribe. Los cambios llegan al instante (Supabase Realtime).
-- Correr una vez en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

create table if not exists public.live_class (
  id int primary key default 1 check (id = 1),
  on_air boolean not null default false,
  sym text,
  sym_name text,
  tf text,
  boards jsonb not null default '{}'::jsonb,   -- { "BOOM1000": [dibujos], "CRASH500": [...] }
  title text,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.live_class (id) values (1) on conflict (id) do nothing;
alter table public.live_class enable row level security;
drop policy if exists "registrados ven la clase" on public.live_class;
create policy "registrados ven la clase" on public.live_class for select using (auth.uid() is not null);
drop policy if exists "admin transmite" on public.live_class;
create policy "admin transmite" on public.live_class for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.teacher_zones (
  sym text primary key,
  sym_name text,
  tf text,
  drawings jsonb not null default '[]'::jsonb,
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.teacher_zones enable row level security;

-- quién puede ver las zonas del profe
create or replace function public.zones_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and not p.banned
               and p.premium_until is not null and p.premium_until > now() and lower(p.plan) in ('oro','diamond'))
    or (coalesce((select (data->>'chartProTrial')::boolean from public.site_settings where id = 1), false)
        and exists (select 1 from public.chart_trials t where t.user_id = auth.uid()
                    and t.started_at + make_interval(days => coalesce((select (data->>'chartTrialDays')::int from public.site_settings where id = 1), 3)) > now()))
$$;
grant execute on function public.zones_ok() to authenticated;

drop policy if exists "oro ve zonas" on public.teacher_zones;
create policy "oro ve zonas" on public.teacher_zones for select using (public.zones_ok());
drop policy if exists "admin publica zonas" on public.teacher_zones;
create policy "admin publica zonas" on public.teacher_zones for all using (public.is_admin()) with check (public.is_admin());

-- cambios en tiempo real
do $$ begin
  begin alter publication supabase_realtime add table public.live_class; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.teacher_zones; exception when duplicate_object then null; end;
end $$;
alter table public.teacher_zones replica identity full;  -- para saber qué mercado se borró

select 'listo' as estado;
