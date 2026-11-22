-- =====================================================================
-- Academia: pasar la salida del curso de diciembre a enero de 2027.
-- Corre todo junto en Supabase → SQL Editor.
-- 1) Muestra cómo están las fechas ahora.
-- 2) Corre las fechas que estaban en diciembre 2026 para que el primer
--    módulo salga el 5 de enero de 2027 (mantiene "uno nuevo cada 5 días").
-- 3) Muestra cómo quedaron.
-- Si prefieres otro día de enero, cambia '2027-01-05' abajo.
-- =====================================================================

-- 1) antes
select title, open_at at time zone 'America/Bogota' as sale_hora_colombia
from public.modules where open_at is not null order by open_at;

-- 2) mover diciembre → enero, sin cambiar el orden ni el espacio entre módulos
with d as (
  select min(open_at) as primero from public.modules
  where open_at >= '2026-11-20' and open_at < '2027-01-01'
)
update public.modules m
set open_at = m.open_at + (('2027-01-05 00:00 America/Bogota')::timestamptz - d.primero)
from d
where d.primero is not null and m.open_at >= d.primero;

-- la fecha de apertura de la academia (si estaba programada para diciembre)
update public.site_settings
set data = jsonb_set(data, '{academyOpenAt}', to_jsonb('2027-01-05T05:00:00.000Z'::text))
where data ? 'academyOpenAt' and (data->>'academyOpenAt') < '2027-01-01';

-- 3) después
select title, open_at at time zone 'America/Bogota' as sale_hora_colombia
from public.modules where open_at is not null order by open_at;
