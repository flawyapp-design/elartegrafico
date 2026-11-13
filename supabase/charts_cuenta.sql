-- =====================================================================
-- EAG Charts: dibujos y diseño guardados en la cuenta + alertas de precio.
-- Correr una vez en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

-- 1) Dibujos, plantillas y diseño de cada alumno (uno por cuenta)
create table if not exists public.chart_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint chart_state_tamano check (pg_column_size(data) < 900000)
);
alter table public.chart_state enable row level security;
drop policy if exists "chart_state ver" on public.chart_state;
create policy "chart_state ver" on public.chart_state for select using (user_id = auth.uid());
drop policy if exists "chart_state crear" on public.chart_state;
create policy "chart_state crear" on public.chart_state for insert with check (user_id = auth.uid());
drop policy if exists "chart_state editar" on public.chart_state;
create policy "chart_state editar" on public.chart_state for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "chart_state borrar" on public.chart_state;
create policy "chart_state borrar" on public.chart_state for delete using (user_id = auth.uid());

-- 2) Alertas de precio (las revisa cada minuto la función send-push y avisa al celular)
create table if not exists public.chart_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (char_length(symbol) between 2 and 30),
  symbol_name text not null default '',
  kind text not null default 'nivel' check (kind in ('nivel','zona')),
  price numeric not null,
  price2 numeric,
  note text not null default '' check (char_length(note) <= 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_check timestamptz not null default now(),
  triggered_at timestamptz,
  triggered_price numeric
);
create index if not exists chart_alerts_activas on public.chart_alerts (active, symbol);
alter table public.chart_alerts enable row level security;
drop policy if exists "alertas ver" on public.chart_alerts;
create policy "alertas ver" on public.chart_alerts for select using (user_id = auth.uid());
drop policy if exists "alertas crear" on public.chart_alerts;
create policy "alertas crear" on public.chart_alerts for insert with check (user_id = auth.uid());
drop policy if exists "alertas editar" on public.chart_alerts;
create policy "alertas editar" on public.chart_alerts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "alertas borrar" on public.chart_alerts;
create policy "alertas borrar" on public.chart_alerts for delete using (user_id = auth.uid());

-- máximo 30 alertas activas por alumno; al crearla o reactivarla se empieza a vigilar desde ese momento
create or replace function public.chart_alerts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active and (tg_op = 'INSERT' or not old.active) then
    if (select count(*) from public.chart_alerts where user_id = new.user_id and active and id <> new.id) >= 30 then
      raise exception 'Máximo 30 alertas activas. Borra alguna para crear otra.';
    end if;
    new.last_check := now(); new.triggered_at := null; new.triggered_price := null;
  end if;
  return new;
end $$;
drop trigger if exists chart_alerts_guard on public.chart_alerts;
create trigger chart_alerts_guard before insert or update on public.chart_alerts
  for each row execute function public.chart_alerts_guard();

select 'listo' as estado,
  (select count(*) from public.chart_state) as disenos_guardados,
  (select count(*) from public.chart_alerts where active) as alertas_activas;
