-- =====================================================================
-- FUNCIONES SUELTAS POR USUARIO (con vencimiento)
-- El admin, desde el chat de EAG Charts (botón 🎁), le da a un alumno
-- funciones específicas por días o meses, sin cambiarle el plan:
--   charts  = gráficos completos (sin los límites de la versión gratis)
--   replay  = Replay del mercado
--   prac    = Práctica guiada
--   zonas   = Zonas del profe
--   tools   = herramientas avanzadas de dibujo
--   ind     = indicadores sin límite
--   alerts  = alertas al celular
--   az      = zonas automáticas de soporte y resistencia
-- Correr en Supabase → SQL Editor. Se puede correr varias veces.
-- =====================================================================

create table if not exists public.user_features (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('charts','replay','prac','zonas','tools','ind','alerts','az')),
  until timestamptz not null,
  granted_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table public.user_features enable row level security;

drop policy if exists "ver mis funciones" on public.user_features;
create policy "ver mis funciones" on public.user_features
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin funciones" on public.user_features;
create policy "admin funciones" on public.user_features
  for all using (public.is_admin()) with check (public.is_admin());
